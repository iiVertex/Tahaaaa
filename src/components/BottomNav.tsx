import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Gift, User } from 'lucide-react';

const Item = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} style={{ textDecoration: 'none' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 4, color: active ? 'var(--qic-primary)' : 'inherit' }}>
        {icon}
        <span style={{ fontSize: 12 }}>{label}</span>
      </div>
    </Link>
  );
};

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--qic-bg)', borderTop: '1px solid var(--qic-border)',
      padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)'
    }}>
      <Item to="/" icon={<Home size={20} />} label="Home" />
      <Item to="/play" icon={<Target size={20} />} label="Missions" />
      <Item to="/rewards" icon={<Gift size={20} />} label="Rewards" />
      <Item to="/profile" icon={<User size={20} />} label="Profile" />
    </nav>
  );
}


