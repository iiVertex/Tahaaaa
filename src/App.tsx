import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Health from './pages/Health';
import Play from './pages/Play';
import Rewards from './pages/Rewards';

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ color: 'var(--qic-primary)' }}>QIC Life MVP</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/">Dashboard</Link>
        <Link to="/play">Play</Link>
        <Link to="/rewards">Rewards</Link>
      </nav>
      <div className="qic-card" style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Health />} />
          <Route path="/play" element={<Play />} />
          <Route path="/rewards" element={<Rewards />} />
        </Routes>
      </div>
    </div>
  );
}


