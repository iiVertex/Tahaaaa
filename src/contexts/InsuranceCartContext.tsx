import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

export type InsurancePlanCartItem = {
  plan_id?: string;
  plan_name: string;
  insurance_type?: string;
  plan_type?: string;
  description?: string;
  estimated_premium?: string;
  relevance_score?: number;
  standard_coverages?: any[];
  optional_add_ons?: any[];
  scenarios?: any[];
  coverage_scenarios?: any[];
  best_plan?: boolean;
  added_at?: string;
};

type CartState = {
  items: InsurancePlanCartItem[];
};

type CartAction =
  | { type: 'ADD_TO_CART'; payload: InsurancePlanCartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string } // plan_id or plan_name
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: InsurancePlanCartItem[] };

const CartContext = createContext<{
  cart: CartState;
  addToCart: (item: InsurancePlanCartItem) => void;
  removeFromCart: (planId: string) => void;
  clearCart: () => void;
  getCartItems: () => InsurancePlanCartItem[];
  isInCart: (planId: string) => boolean;
  cartItemCount: number;
} | null>(null);

const CART_STORAGE_KEY = 'qic_insurance_cart';

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      // Check if item already exists
      const existingIndex = state.items.findIndex(
        item => (item.plan_id && item.plan_id === action.payload.plan_id) ||
                item.plan_name === action.payload.plan_name
      );
      
      if (existingIndex >= 0) {
        // Item already in cart, don't duplicate
        return state;
      }
      
      return {
        items: [...state.items, { ...action.payload, added_at: new Date().toISOString() }]
      };
    }
    case 'REMOVE_FROM_CART':
      return {
        items: state.items.filter(
          item => (item.plan_id && item.plan_id !== action.payload) &&
                  item.plan_name !== action.payload
        )
      };
    case 'CLEAR_CART':
      return { items: [] };
    case 'LOAD_CART':
      return { items: action.payload };
    default:
      return state;
  }
}

const initialState: CartState = {
  items: []
};

export function InsuranceCartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          dispatch({ type: 'LOAD_CART', payload: parsed });
        }
      }
    } catch (error) {
      console.warn('[Cart] Failed to load cart from localStorage:', error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart.items));
    } catch (error) {
      console.warn('[Cart] Failed to save cart to localStorage:', error);
    }
  }, [cart.items]);

  const addToCart = (item: InsurancePlanCartItem) => {
    dispatch({ type: 'ADD_TO_CART', payload: item });
  };

  const removeFromCart = (planId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: planId });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getCartItems = () => cart.items;

  const isInCart = (planId: string) => {
    return cart.items.some(
      item => (item.plan_id && item.plan_id === planId) || item.plan_name === planId
    );
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        getCartItems,
        isInCart,
        cartItemCount: cart.items.length
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useInsuranceCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useInsuranceCart must be used within InsuranceCartProvider');
  }
  return context;
}

