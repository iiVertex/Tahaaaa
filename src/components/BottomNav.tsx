import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Item = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  const location = useLocation();
  const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} style={{ textDecoration: 'none' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 4, color: active ? '#111' : 'inherit' }}>
        <div style={{
          background: active ? 'var(--qic-accent)' : 'transparent',
          borderRadius: 10, padding: 8, display: 'grid', placeItems: 'center'
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: active ? 'var(--qic-accent)' : undefined }}>{label}</span>
      </div>
    </Link>
  );
};

export default function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--qic-surface)', borderTop: '1px solid var(--qic-border)',
      padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)'
    }}>
      <Item to="/" icon={<Home size={20} />} label={t('nav.home')} />
      <Item to="/play" icon={<Target size={20} />} label={t('nav.missions')} />
      <Item to="/rewards" icon={<Gift size={20} />} label={t('nav.rewards')} />
    </nav>
  );
}


