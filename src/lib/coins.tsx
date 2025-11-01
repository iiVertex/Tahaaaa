import React from 'react';
import { getProfile } from './api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type CoinsContextValue = {
  coins: number;
  addCoins: (delta: number) => Promise<void>;
  setCoins: (value: number) => Promise<void>;
  refreshCoins: () => Promise<void>;
  isLoading: boolean;
};

const CoinsContext = React.createContext<CoinsContextValue | undefined>(undefined);

export function CoinsProvider({ children }: React.PropsWithChildren<{}>) {
  const qc = useQueryClient();
  const [coins, setCoinsState] = React.useState<number>(1000); // Default fallback
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch coins from backend on mount and when profile changes
  const { data: profile } = useQuery({ 
    queryKey: ['profile'], 
    queryFn: getProfile,
    staleTime: 30000, // Consider fresh for 30 seconds
    refetchOnMount: true,
  });

  // Update coins from profile data
  React.useEffect(() => {
    if (profile) {
      const backendCoins = (profile as any)?.user?.coins ?? (profile as any)?.data?.user?.coins ?? 1000;
      setCoinsState(backendCoins);
      setIsLoading(false);
    } else {
      // If no profile yet, use default
      setCoinsState(1000);
      setIsLoading(false);
    }
  }, [profile]);

  // Refresh coins from backend
  const refreshCoins = React.useCallback(async () => {
    try {
      const freshProfile = await qc.fetchQuery({ queryKey: ['profile'], queryFn: getProfile });
      const backendCoins = (freshProfile as any)?.user?.coins ?? (freshProfile as any)?.data?.user?.coins ?? coins;
      setCoinsState(backendCoins);
    } catch (error) {
      console.error('Failed to refresh coins:', error);
    }
  }, [qc, coins]);

  // Set coins (updates backend via profile update - coins are part of user record)
  const setCoins = React.useCallback(async (value: number) => {
    setCoinsState(value);
    // Backend will update coins through gamification service or user update
    // For now, optimistic update - backend will sync on next profile fetch
    await refreshCoins();
  }, [refreshCoins]);

  // Add coins (optimistic update, backend syncs through mission/reward completion)
  const addCoins = React.useCallback(async (delta: number) => {
    const newCoins = Math.max(0, coins + delta);
    setCoinsState(newCoins);
    // Refresh from backend to ensure sync (backend handles actual persistence)
    await refreshCoins();
  }, [coins, refreshCoins]);

  const value = React.useMemo(() => ({ 
    coins, 
    setCoins, 
    addCoins, 
    refreshCoins,
    isLoading 
  }), [coins, setCoins, addCoins, refreshCoins, isLoading]);

  return <CoinsContext.Provider value={value}>{children}</CoinsContext.Provider>;
}

export function useCoins() {
  const ctx = React.useContext(CoinsContext);
  if (!ctx) throw new Error('useCoins must be used within CoinsProvider');
  return ctx;
}
