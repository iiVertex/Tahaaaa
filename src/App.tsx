import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Health from './pages/Health';
import Missions from './pages/Missions';
import Scenarios from './pages/Scenarios';
import Rewards from './pages/Rewards';
import SkillTree from './pages/SkillTree';
import Social from './pages/Social';
import Profile from './pages/Profile';

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ color: 'var(--qic-primary)' }}>QIC Life MVP</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/">Health</Link>
        <Link to="/missions">Missions</Link>
        <Link to="/scenarios">Scenarios</Link>
        <Link to="/rewards">Rewards</Link>
        <Link to="/skill-tree">Skill Tree</Link>
        <Link to="/social">Social</Link>
        <Link to="/profile">Profile</Link>
      </nav>
      <div className="qic-card" style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Health />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/scenarios" element={<Scenarios />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/skill-tree" element={<SkillTree />} />
          <Route path="/social" element={<Social />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </div>
  );
}


