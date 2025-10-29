import React from 'react';
import { motion } from 'framer-motion';
import { pulseVariants, cardEntranceVariants } from '@/lib/animations';

type Insight = { title: string; detail?: string; confidence?: number; priority?: 'high'|'medium'|'low'; action_hint?: string };

export default function InsightCard({ insight }: { insight: Insight }) {
  const confidencePct = Math.round((insight.confidence ?? 0) * 100);
  const badgeColor = insight.priority === 'high' ? '#800000' : insight.priority === 'medium' ? '#444097' : '#6b7280';
  return (
    <motion.div className="qic-card" style={{ padding: 12 }} variants={cardEntranceVariants} initial="initial" animate="animate">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <b>{insight.title}</b>
            {insight.priority && (
              <span style={{ fontSize: 12, background: badgeColor, color: 'white', padding: '2px 6px', borderRadius: 6, textTransform: 'capitalize' }}>{insight.priority}</span>
            )}
          </div>
          {insight.detail && <div style={{ opacity: 0.85 }}>{insight.detail}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 8, background: '#E6E8EE', borderRadius: 6, overflow: 'hidden' }} aria-label={`Confidence ${confidencePct}%`}>
              <motion.div style={{ height: '100%', background: 'var(--qic-accent)' }} animate={{ width: `${confidencePct}%` }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{confidencePct}%</span>
          </div>
        </div>
        {insight.priority === 'high' && (
          <motion.div variants={pulseVariants} initial="initial" animate="animate" style={{ width: 10, height: 10, borderRadius: 9999, background: 'var(--qic-accent)' }} />
        )}
      </div>
      {insight.action_hint && (
        <div style={{ marginTop: 8 }}>
          <button style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}>{insight.action_hint}</button>
        </div>
      )}
    </motion.div>
  );
}


