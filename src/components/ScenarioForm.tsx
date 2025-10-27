import React from 'react';

export default function ScenarioForm({ initial, onSubmit, loading }:{ initial?: any; onSubmit: (values:any)=>void; loading?: boolean }) {
  const [values, setValues] = React.useState({ walk_minutes: 30, diet_quality: 'good', commute_distance: 10, seatbelt_usage: 'always', ...(initial||{}) });
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onSubmit(values); }} style={{ display: 'grid', gap: 8 }}>
      <label>
        Walk Minutes
        <input type="number" value={values.walk_minutes} onChange={e => setValues({ ...values, walk_minutes: Number(e.target.value) })} />
      </label>
      <label>
        Diet Quality
        <select value={values.diet_quality} onChange={e => setValues({ ...values, diet_quality: e.target.value })}>
          <option value="excellent">excellent</option>
          <option value="good">good</option>
          <option value="fair">fair</option>
          <option value="poor">poor</option>
        </select>
      </label>
      <label>
        Commute Distance (km)
        <input type="number" value={values.commute_distance} onChange={e => setValues({ ...values, commute_distance: Number(e.target.value) })} />
      </label>
      <label>
        Seatbelt Usage
        <select value={values.seatbelt_usage} onChange={e => setValues({ ...values, seatbelt_usage: e.target.value })}>
          <option value="always">always</option>
          <option value="often">often</option>
          <option value="rarely">rarely</option>
        </select>
      </label>
      <button type="submit" disabled={loading}>Simulate</button>
    </form>
  );
}


