import React, { useEffect, useState } from 'react';

export default function Health() {
  const [status, setStatus] = useState<string>('Checking...');

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((r) => r.json())
      .then((j) => setStatus(`${j.data?.status || 'OK'} — v${j.data?.version || 'n/a'}`))
      .catch((e) => setStatus(`Error: ${e?.message || e}`));
  }, []);

  return (
    <div>
      <h2>Health</h2>
      <p>{status}</p>
    </div>
  );
}


