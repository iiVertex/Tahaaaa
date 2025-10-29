import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ScenarioForm({ initial, onSubmit, loading }:{ initial?: any; onSubmit: (values:any)=>void; loading?: boolean }) {
  const { t } = useTranslation();
  const [values, setValues] = React.useState({ walk_minutes: 30, diet_quality: 'good', commute_distance: 10, seatbelt_usage: 'always', ...(initial||{}) });
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onSubmit(values); }} style={{ display: 'grid', gap: 8 }}>
      <label>
        {t('scenarios.walkMinutes')}
        <input type="number" value={values.walk_minutes} onChange={e => setValues({ ...values, walk_minutes: Number(e.target.value) })} />
      </label>
      <label>
        {t('scenarios.dietQuality')}
        <select value={values.diet_quality} onChange={e => setValues({ ...values, diet_quality: e.target.value })}>
          <option value="excellent">{t('scenarios.diet.excellent')}</option>
          <option value="good">{t('scenarios.diet.good')}</option>
          <option value="fair">{t('scenarios.diet.fair')}</option>
          <option value="poor">{t('scenarios.diet.poor')}</option>
        </select>
      </label>
      <label>
        {t('scenarios.commuteDistance')}
        <input type="number" value={values.commute_distance} onChange={e => setValues({ ...values, commute_distance: Number(e.target.value) })} />
      </label>
      <label>
        {t('scenarios.seatbeltUsage')}
        <select value={values.seatbelt_usage} onChange={e => setValues({ ...values, seatbelt_usage: e.target.value })}>
          <option value="always">{t('scenarios.seatbelt.always')}</option>
          <option value="often">{t('scenarios.seatbelt.often')}</option>
          <option value="rarely">{t('scenarios.seatbelt.rarely')}</option>
        </select>
      </label>
      <button type="submit" disabled={loading}>{loading ? t('scenarios.simulating') : t('simulate')}</button>
    </form>
  );
}


