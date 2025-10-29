import React from 'react';
import QatarPattern from '@/components/QatarPattern';
import BottomNav from '@/components/BottomNav';
import { useTranslation } from 'react-i18next';

type MajlisLayoutProps = {
  titleKey: string;
  icon?: React.ReactNode;
  pattern?: 'stars' | 'mosaic';
  headerExtras?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bottomNav?: boolean;
};

export default function MajlisLayout({
  titleKey,
  icon,
  pattern = 'stars',
  headerExtras,
  actions,
  bottomNav = true,
  children
}: MajlisLayoutProps) {
  const { t } = useTranslation();

  return (
    <div style={{ position: 'relative', paddingBottom: bottomNav ? 80 : 24 }}>
      <QatarPattern variant={pattern} opacity={0.05} />
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <h2 style={{ margin: 0 }}>{t(titleKey)}</h2>
        </div>
        {(headerExtras || actions) && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
            {headerExtras}
            {actions}
          </div>
        )}
      </header>
      <main style={{ display: 'grid', gap: 16 }}>{children}</main>
      {bottomNav && <BottomNav />}
    </div>
  );
}


