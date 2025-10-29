import React, { useState } from 'react';
import { simulateScenario } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { DatePalmIcon } from '@/components/QatarAssets';
import MajlisLayout from '@/components/MajlisLayout';

export default function Scenarios() {
  const { t } = useTranslation();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const run = async () => {
    setLoading(true);
    try {
      const data = await simulateScenario({
        lifestyle_factors: { age: 30, occupation: 'engineer' },
      });
      setResult(data?.data || data);
    } catch (e: any) {
      setResult({ error: t('errors.simulateScenario', { message: e?.message || '' }) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MajlisLayout titleKey="scenarios.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      <button onClick={run} disabled={loading}>{loading ? t('scenarios.simulating') : t('simulate')}</button>
      {!result && (
        <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatePalmIcon size={18} color="var(--qic-secondary)" />
          <div>{t('scenarios.empty')}</div>
        </div>
      )}
      {result && (
        <pre style={{ background: '#111418', padding: 12, borderRadius: 8, marginTop: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </MajlisLayout>
  );
}


