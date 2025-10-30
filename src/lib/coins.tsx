import React from 'react';

const COINS_STORAGE_KEY = 'qic_coins_v1';

function loadCoins(): number {
  try {
    const s = localStorage.getItem(COINS_STORAGE_KEY);
    const n = s ? parseInt(s, 10) : NaN;
    return Number.isFinite(n) ? n : 100;
  } catch { return 100; }
}

function saveCoins(value: number) {
  try { localStorage.setItem(COINS_STORAGE_KEY, String(value)); } catch {}
}

type CoinsContextValue = {
  coins: number;
  addCoins: (delta: number) => void;
  setCoins: (value: number) => void;
};

const CoinsContext = React.createContext<CoinsContextValue | undefined>(undefined);

export function CoinsProvider({ children }: React.PropsWithChildren<{}>) {
  const [coins, setCoinsState] = React.useState<number>(() => loadCoins());
  const setCoins = React.useCallback((v: number) => { setCoinsState(v); saveCoins(v); }, []);
  const addCoins = React.useCallback((d: number) => setCoins(Math.max(0, coins + d)), [coins, setCoins]);
  const value = React.useMemo(() => ({ coins, setCoins, addCoins }), [coins, setCoins, addCoins]);
  return <CoinsContext.Provider value={value}>{children}</CoinsContext.Provider>;
}

export function useCoins() {
  const ctx = React.useContext(CoinsContext);
  if (!ctx) throw new Error('useCoins must be used within CoinsProvider');
  return ctx;
}


