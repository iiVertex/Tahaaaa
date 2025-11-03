import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePlanDetailTemplate } from '@/utils/planDetailTemplates';
import { simulatePlanDetail } from '@/lib/api';
import { useCoins } from '@/lib/coins';
import { useToast } from '@/components/Toast';

type PlanDetailViewProps = {
  open: boolean;
  onClose: () => void;
  plan: any;
  userProfile: any;
  scenarioText?: string;
  isAIGenerated?: boolean;
};

type PlanDetailContent = {
  header: string;
  welcomeMessage: string;
  whyItFits: string[];
  coverageTable: Array<{
    coverageItem: string;
    limit: string;
    whatsCovered: string;
    whyItMatters: string;
  }>;
  scenarios: Array<{
    title: string;
    description: string;
    lifescoreWithCoverage: number;
    lifescoreWithoutCoverage: number;
    netBenefit: number;
    savings?: string;
  }>;
  exclusions: string[];
  nextSteps: Array<{
    step: number;
    title: string;
    description: string;
    link?: string;
  }>;
  contactInfo: string;
};

export default function PlanDetailView({
  open,
  onClose,
  plan,
  userProfile,
  scenarioText,
  isAIGenerated = false
}: PlanDetailViewProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { coins } = useCoins();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<PlanDetailContent | null>(null);

  useEffect(() => {
    if (open && plan) {
      setLoading(true);
      if (isAIGenerated && scenarioText) {
        // AI-generated: Call backend API
        generateAIContent();
      } else {
        // Rule-based: Use template generator
        generateTemplateContent();
      }
    }
  }, [open, plan, isAIGenerated, scenarioText]);

  const generateTemplateContent = () => {
    try {
      const templateContent = generatePlanDetailTemplate(plan, userProfile, scenarioText);
      setContent(templateContent);
      setLoading(false);
    } catch (error: any) {
      console.error('Error generating template content:', error);
      toast?.error?.('Failed to load plan details', error?.message);
      setLoading(false);
    }
  };

  const generateAIContent = async () => {
    try {
      const response = await simulatePlanDetail({
        plan,
        user_profile: userProfile,
        scenario_description: scenarioText || ''
      });
      setContent(response?.data || response);
      setLoading(false);
    } catch (error: any) {
      console.error('Error generating AI content:', error);
      // Fallback to template if AI fails
      generateTemplateContent();
    }
  };

  if (!open) return null;

  const profile = userProfile?.profile_json || userProfile || {};
  const userName = profile.name || 'User';
  const userAge = profile.age || 30;
  const userGender = profile.gender || '';
  const userNationality = profile.nationality || '';
  const userBudget = profile.budget || 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        className="qic-card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24,
          background: 'white'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            fontSize: 24,
            cursor: 'pointer',
            color: '#666',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#f5f5f5'
          }}
        >
          ×
        </button>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div>Loading plan details...</div>
          </div>
        ) : content ? (
          <>
            {/* Header */}
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: 'var(--qic-primary)' }}>
              {content.header || `${plan.plan_name || plan.name} - Personalized for ${userName}`}
            </h1>

            {/* Welcome Message */}
            <div style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 24, color: '#333' }}>
              <strong>Hi {userName},</strong>
              <p style={{ marginTop: 12 }}>{content.welcomeMessage}</p>
            </div>

            {/* Why This Insurance Fits You */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
                Why This Insurance Fits You Perfectly
              </h2>
              <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                {content.whyItFits.map((reason, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>{reason}</li>
                ))}
              </ul>
            </div>

            {/* Key Coverage Details Table */}
            {content.coverageTable && content.coverageTable.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
                  Key Coverage Details
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: 'var(--qic-secondary)', color: 'white' }}>
                        <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Coverage Item</th>
                        <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Limit</th>
                        <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>What's Covered</th>
                        <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Why It Matters for You</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.coverageTable.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 12, border: '1px solid #eee', fontWeight: 600 }}>
                            {row.coverageItem}
                          </td>
                          <td style={{ padding: 12, border: '1px solid #eee' }}>{row.limit}</td>
                          <td style={{ padding: 12, border: '1px solid #eee' }}>{row.whatsCovered}</td>
                          <td style={{ padding: 12, border: '1px solid #eee' }}>{row.whyItMatters}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Real-Life Scenarios */}
            {content.scenarios && content.scenarios.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--qic-primary)' }}>
                  Real-Life Scenarios: How This Protects You
                </h2>
                <div style={{ display: 'grid', gap: 16 }}>
                  {content.scenarios.map((scenario, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 16,
                        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                        border: '2px solid #4caf50',
                        borderRadius: 8
                      }}
                    >
                      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#2e7d32' }}>
                        {idx + 1}. {scenario.title}
                      </h3>
                      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12, color: '#333' }}>
                        {scenario.description}
                      </p>
                      {scenario.savings && (
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', marginBottom: 12 }}>
                          {scenario.savings}
                        </p>
                      )}
                      
                      {/* LifeScore Impacts */}
                      <div style={{ display: 'flex', gap: 24, marginTop: 12, paddingTop: 12, borderTop: '1px solid #81c784' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>With Coverage:</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32' }}>
                            +{scenario.lifescoreWithCoverage}
                          </div>
                          <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>Protected from loss</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Without Coverage:</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#c62828' }}>
                            {scenario.lifescoreWithoutCoverage}
                          </div>
                          <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>Potential loss</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Net Benefit:</div>
                          <div style={{ fontSize: 32, fontWeight: 700, color: '#1b5e20' }}>
                            +{scenario.netBenefit}
                          </div>
                          <div style={{ fontSize: 10, color: '#666' }}>LifeScore saved</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exclusions */}
            {content.exclusions && content.exclusions.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
                  Exclusions to Know (Quick Heads-Up)
                </h2>
                <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                  {content.exclusions.map((exclusion, idx) => (
                    <li key={idx} style={{ marginBottom: 8 }}>{exclusion}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {content.nextSteps && content.nextSteps.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
                  Next Steps: Secure Your Coverage
                </h2>
                <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                  {content.nextSteps.map((step) => (
                    <li key={step.step} style={{ marginBottom: 12 }}>
                      <strong>{step.title}:</strong> {step.description}
                      {step.link && (
                        <a href={step.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--qic-secondary)', marginLeft: 8 }}>
                          {step.link}
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Contact Info */}
            {content.contactInfo && (
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, fontSize: 14, lineHeight: 1.6 }}>
                {content.contactInfo}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div>Unable to load plan details</div>
          </div>
        )}
      </div>
    </div>
  );
}

