import { useEffect, useState } from 'react';
import { api } from '@/lib/requests';

type ModuleKey = 'health-summary' | 'ai-insights' | 'suggested-missions' | 'general-missions' | 'rewards-offers';

const DEFAULT_ORDER: ModuleKey[] = ['health-summary', 'ai-insights', 'suggested-missions', 'general-missions', 'rewards-offers'];

export function usePersonalization() {
  const [order, setOrder] = useState<ModuleKey[]>(DEFAULT_ORDER);
  const [loading, setLoading] = useState<boolean>(false);
  const [flags, setFlags] = useState<{ offers_enabled?: boolean; referrals_enabled?: boolean; insurance_sim_enabled?: boolean }>({});
  const [nudges, setNudges] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get('/personalization/layout')
      .then(({ data }) => {
        const j = data?.data ?? data;
        const mods = (j?.modules || []).map((m:any)=>m.key);
        if (Array.isArray(mods) && mods.length > 0) setOrder(['health-summary','ai-insights','suggested-missions','general-missions','rewards-offers'].filter(k=>mods.includes(k) || true) as ModuleKey[]);
        setFlags(j?.flags || {});
        setNudges(j?.nudges || []);
      }).catch(()=>{}).finally(()=> setLoading(false));
  }, []);

  return { order, loading, flags, nudges };
}

export default usePersonalization;


