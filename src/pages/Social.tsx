import React, { useEffect, useState } from 'react';
import { getSocialFeed } from '@/lib/api';

export default function Social() {
  const [feed, setFeed] = useState<{ friends: any[]; leaderboard: any[] }>({ friends: [], leaderboard: [] });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSocialFeed()
      .then((f) => setFeed(f || { friends: [], leaderboard: [] }))
      .catch((e) => setError(e?.message || 'Failed to load social feed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Social</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div className="qic-card" style={{ padding: 12 }}>
        <pre style={{ margin: 0 }}>
          {JSON.stringify(feed, null, 2)}
        </pre>
      </div>
    </div>
  );
}


