import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Collapsible from '@radix-ui/react-collapsible';
import { simulateScenario, getProfile, startMission, completeMission, getRecommendationsContext } from '../lib/api';
import MajlisLayout from '@/components/MajlisLayout';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCoins } from '@/lib/coins';
import { insurancePlans, matchPlansByScenario, rerankByProfile, getTipsForPlanType, getDiscounts, type PlanType } from '@/data/insurancePlans';
import { track } from '@/lib/analytics';
import { useToast } from '@/components/Toast';
import QuoteDrawer from '@/components/QuoteDrawer';
import { useInsuranceCart } from '@/contexts/InsuranceCartContext';
import PlanDetailView from '@/components/PlanDetailView';

export default function Showcase() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { coins, addCoins, refreshCoins } = useCoins();
  const toast = useToast();
  const { addToCart, isInCart } = useInsuranceCart();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const prefs = (profile as any)?.userProfile?.profile_json?.preferences || null;
  const { data: recommendations } = useQuery({
    queryKey: ['ai','recommendations', prefs],
    queryFn: () => getRecommendationsContext({ preferences: prefs })
  });
  // Social leaderboard removed in this phase to eliminate 401s and unnecessary calls.

  // Extract user profile data for personalization
  const userName = (profile as any)?.userProfile?.profile_json?.name || '';
  const userVulnerabilities = (profile as any)?.userProfile?.profile_json?.vulnerabilities || [];
  const userAge = (profile as any)?.userProfile?.profile_json?.age || 30;
  const userNationality = (profile as any)?.userProfile?.profile_json?.nationality || null;
  const userBudget = (profile as any)?.userProfile?.profile_json?.budget || 0;

  const profileCtx = React.useMemo(() => ({
    nationality: userNationality,
    budgetQr: userBudget,
    preferences: prefs,
    firstTimeBuyer: !!(profile as any)?.userProfile?.profile_json?.first_time_buyer
  }), [profile, prefs, userNationality, userBudget]);

  const [scenarioText, setScenarioText] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>('');
  const [planResults, setPlanResults] = React.useState<any[]>([]);
  const [planDiscounts, setPlanDiscounts] = React.useState<any[]>([]);
  // Track if current scenario is from a default button (rule-based) or custom input (API-based)
  const [isDefaultButton, setIsDefaultButton] = React.useState(false);
  const [expandedPlanIndex, setExpandedPlanIndex] = React.useState<number | null>(null);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quoteProductId, setQuoteProductId] = React.useState<string | undefined>(undefined);
  const [selectedPlanForDetail, setSelectedPlanForDetail] = React.useState<{ plan: any; scenarioText?: string; isAIGenerated: boolean } | null>(null);
  
  // Calculate LifeScore impact for scenarios
  const calculateLifescoreImpact = React.useCallback((severityScore: number): number => {
    if (severityScore >= 8) return -15; // High severity
    if (severityScore >= 5) return -8;  // Medium severity
    return -5; // Low severity
  }, []);

  async function onSimulate(values: any) {
    setLoading(true); setError(null);
    try {
      const response = await simulateScenario(values);
      const prediction = response?.data || response;
      setResult(prediction);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await refreshCoins(); // Refresh coins from backend (showcase simulation doesn't give coins directly)
      setMessage(t('showcase.simulationComplete'));
    } catch (err: any) {
      // NO MOCK DATA - Show error instead
      const errorMsg = err?.response?.data?.message || err?.message || 'AI API unavailable';
      const fullError = `AI API Error: ${errorMsg}. Please ensure backend is running and OPENAI_API_KEY is configured.`;
      setError(fullError);
      toast?.error?.('AI API Unavailable', 'Unable to generate AI recommendations. Please check your connection and backend configuration.');
      console.error('[Showcase] AI API call failed:', err);
    } finally { setLoading(false); }
  }

  // Default button scenarios (rule-based) - STRICT category mapping for direct relevance
  const defaultScenarios = [
    { text: 'Family road trip to Salwa in June; new SUV within 3 years, want agency repairs and GCC cover.', category: 'car' },
    { text: 'Two-week Europe vacation in December; Schengen visa, skiing planned.', category: 'travel' },
    { text: 'Renting a new apartment; need contents and theft coverage.', category: 'home' }
  ];

  async function onPlanScenarioSubmit() {
    setError(null); setMessage(null);
    setLoading(true);
    
    // Check if scenario is from a default button (rule-based) or custom input (API-based)
    const defaultScenario = defaultScenarios.find(ds => scenarioText.trim() === ds.text.trim());
    const isDefault = !!defaultScenario;
    setIsDefaultButton(isDefault);
    
    try {
      if (isDefault) {
        // Rule-based for default buttons - STRICT category enforcement for direct relevance
        const categoryHint = defaultScenario?.category || (category || '').toLowerCase();
        // Only match plans in the exact category (direct relevance requirement)
        const matched = matchPlansByScenario(scenarioText, categoryHint as PlanType);
        const ranked = rerankByProfile(matched, profileCtx);
        const discounts = getDiscounts(profileCtx);
        // Limit to max 3 directly relevant plans (already filtered by matchPlansByScenario)
        setPlanResults(ranked.slice(0, 3));
        setPlanDiscounts(discounts);
        setResult(null); // Clear API result if any
      } else {
        // API-based for custom input - ALWAYS call real AI API
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const season = currentMonth >= 3 && currentMonth <= 5 ? 'spring' :
                      currentMonth >= 6 && currentMonth <= 8 ? 'summer' :
                      currentMonth >= 9 && currentMonth <= 11 ? 'autumn' : 'winter';
        
        try {
          const response = await simulateScenario({
            scenario_description: scenarioText,
            category: category || undefined,
            lifestyle_factors: {
              age: userAge,
              nationality: userNationality,
              budget: userBudget
            },
            user_profile: {
              name: userName,
              age: userAge,
              nationality: userNationality,
              budget: userBudget,
              vulnerabilities: userVulnerabilities
            },
            time_context: {
              month: currentMonth,
              season: season,
              year: new Date().getFullYear()
            }
          });
          
          // Backend returns: { success: true, data: { ...prediction, scenarios: [...] } }
          // Backend SPREADS prediction into data, so response.data IS the prediction
          const responseData = response?.data || response;
          // responseData IS the prediction (spread from backend) - no nested prediction property
          const prediction = responseData;
          
          // CRITICAL: Extract scenarios directly from responseData (prediction is spread)
          const scenarios = prediction?.scenarios || [];
          
          // Debug logging
          if (import.meta.env.DEV) {
            console.log('[Showcase] Response structure:', {
              hasResponse: !!response,
              hasResponseData: !!response?.data,
              responseKeys: response ? Object.keys(response) : [],
              responseDataKeys: responseData ? Object.keys(responseData) : [],
              hasScenarios: !!prediction?.scenarios,
              scenariosCount: scenarios.length,
              hasBestPlan: !!prediction?.best_plan,
              hasRecommendedPlans: !!prediction?.recommended_plans
            });
          }
          
          if (scenarios.length === 0) {
            console.warn('[Showcase] No scenarios in AI response, will show fallback message');
          }
          
          // Extract best_plan (new structure) or fallback to recommended_plans array (backward compatibility)
          let bestPlan = null;
          if (prediction?.best_plan) {
            // New structure: single best_plan
            bestPlan = prediction.best_plan;
          } else if (prediction?.recommended_plans && Array.isArray(prediction.recommended_plans) && prediction.recommended_plans.length > 0) {
            // Fallback: select top plan from array (highest relevance_score, Maslow-prioritized if equal)
            const sorted = [...prediction.recommended_plans].sort((a: any, b: any) => {
              const scoreA = a.relevance_score || 0;
              const scoreB = b.relevance_score || 0;
              if (scoreB !== scoreA) return scoreB - scoreA;
              
              // If scores equal, prioritize by Maslow hierarchy
              const maslowOrder: Record<string, number> = {
                'Health Insurance': 1, 'Medical': 1,
                'Car Insurance': 2, 'Home': 2, 'Property': 2,
                'Travel Insurance': 3, 'Family': 3,
                'Life Insurance': 4
              };
              const orderA = maslowOrder[a.insurance_type || ''] || 5;
              const orderB = maslowOrder[b.insurance_type || ''] || 5;
              return orderA - orderB;
            });
            bestPlan = sorted[0];
          }
          
          // Match bestPlan to insurancePlans.json structure and merge real coverage data
          if (bestPlan && bestPlan.plan_name) {
            try {
              const insurancePlansData = await import('@/data/insurancePlans.json').then(m => m.default || []);
              // Find matching plan in JSON
              for (const insuranceType of insurancePlansData) {
                const matchedPlan = insuranceType.plans?.find((p: any) => 
                  p.plan_name === bestPlan.plan_name || 
                  p.plan_name.toLowerCase() === bestPlan.plan_name.toLowerCase()
                );
                if (matchedPlan) {
                  // Merge real coverage data from JSON into bestPlan
                  bestPlan.standard_coverages = matchedPlan.standard_coverages || bestPlan.standard_coverages || [];
                  bestPlan.optional_add_ons = matchedPlan.optional_add_ons || bestPlan.optional_add_ons || [];
                  break;
                }
              }
            } catch (e) {
              console.warn('Failed to load insurancePlans.json for matching:', e);
            }
          }
          
          // Store best_plan in result - PRESERVE scenarios array (CRITICAL)
          // prediction already contains all fields from backend (scenarios, narrative, severity_score, etc.)
          const finalResult: any = {
            ...prediction,
            best_plan: bestPlan,
            recommended_plans: bestPlan ? [bestPlan] : [], // Keep for backward compatibility
            // CRITICAL: ALWAYS include scenarios - use extracted scenarios
            scenarios: scenarios.length > 0 ? scenarios : (prediction?.scenarios || [])
          };
          
          // Log for debugging
          if (import.meta.env.DEV) {
            console.log('[Showcase] Final result scenarios count:', finalResult.scenarios?.length || 0);
            console.log('[Showcase] Has best_plan:', !!finalResult.best_plan);
          }
          
          setResult(finalResult);
          
          // Clear any previous errors
          setError(null);
          
          // Store suggested missions in localStorage for Missions page
          if (prediction?.suggested_missions && Array.isArray(prediction.suggested_missions) && prediction.suggested_missions.length > 0) {
            try {
              localStorage.setItem('qic_ai_suggested_missions', JSON.stringify({
                missions: prediction.suggested_missions,
                generatedAt: new Date().toISOString(),
                scenarioText: scenarioText.substring(0, 100) // Store context
              }));
            } catch (e) {
              console.warn('Failed to store suggested missions:', e);
            }
          }
          
          setPlanResults([]); // Clear rule-based results
          setPlanDiscounts([]);
          
          if (userName) {
            toast?.success?.(`Hi ${userName}!`, t('showcase.simulationComplete') || 'AI-powered recommendations ready');
          } else {
            toast?.success?.(t('showcase.simulationComplete') || 'AI analysis complete');
          }
        } catch (apiError: any) {
          // Check if it's a credit/disabled error (503 with disabled flag)
          const isDisabled = apiError?.response?.status === 503 && apiError?.response?.data?.disabled;
          const errorMsg = apiError?.response?.data?.message || apiError?.message || 'AI API unavailable';
          
          if (isDisabled || errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API')) {
            setError(`AI service temporarily unavailable: ${errorMsg}. Coins were not deducted.`);
            toast?.warning?.('AI Service Unavailable', 'AI features are temporarily disabled. Please try again later.');
          } else {
            setError(`AI analysis failed: ${errorMsg}. Please ensure backend is running and OPENAI_API_KEY is configured.`);
            toast?.error?.('AI API Error', errorMsg);
          }
          throw apiError; // Re-throw so finally block doesn't show success
        }
      }
      
      await refreshCoins();
      try { track('scenario_submit', { category: category || 'auto', text_len: scenarioText.length, is_default: isDefault }); } catch {}
      setMessage(t('showcase.simulationComplete'));
    } catch (err: any) {
      // Only show error for default buttons if it's a different error
      if (isDefault && err?.message) {
        setError(t('errors.simulateScenario', { message: err?.message || '' }));
      } else if (!isDefault) {
        // Custom input should have already shown error above, but catch any other errors
        if (!error) {
          setError(`Failed to process scenario: ${err?.message || 'Unknown error'}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function onStartMission(id: string) {
    setLoading(true); setError(null);
    try {
      await startMission(id);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['missions'] });
      await refreshCoins(); // Refresh coins from backend
      toast?.success?.(t('showcase.missionStarted') || 'Mission started!', t('showcase.checkMissionsTab') || 'Check Missions tab');
      setMessage(t('showcase.missionStarted'));
      // Redirect to Missions tab with mission ID in URL to auto-expand steps
      setTimeout(() => {
        navigate(`/missions?started=${id}`);
      }, 1000);
    } catch (err: any) { 
      const errorMsg = err?.message || '';
      if (errorMsg.includes('already started') || errorMsg.includes('active')) {
        setError(t('errors.missionAlreadyActive') || 'You already have an active mission. Complete it first or check the Missions tab.');
        toast?.error?.(t('errors.missionAlreadyActive') || 'You already have an active mission');
      } else {
        setError(t('errors.startMission', { message: errorMsg }));
      }
    }
    finally { setLoading(false); }
  }

  async function onCompleteMission(id: string) {
    setLoading(true); setError(null);
    try {
      await completeMission(id);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await refreshCoins(); // Refresh coins from backend (mission completion awards coins via backend)
      setMessage(t('showcase.missionCompleted'));
    } catch (err: any) { setError(t('errors.completeMission', { message: err?.message || '' })); }
    finally { setLoading(false); }
  }

  return (
    <MajlisLayout titleKey="showcase.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {/* Welcome Description */}
      <div className="qic-card-majlis" style={{ 
        padding: 20, 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(68, 64, 151, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        border: '2px solid var(--qic-secondary)',
        borderRadius: 12
      }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
          <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>🤖 Your AI-Powered Insurance Advisor</strong>
          <p style={{ margin: '12px 0 0 0' }}>
            Imagine having a personal insurance expert who understands your lifestyle, dreams, and concerns. 
            Describe any scenario—from planning your next adventure to protecting your growing family—and our AI will analyze your needs 
            and recommend the perfect insurance solutions tailored just for you. See how different scenarios could impact your life, 
            and discover coverage that gives you peace of mind.
          </p>
        </div>
      </div> 
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {message && <div style={{ color: 'seagreen' }}>{message}</div>}
      {userName && (
        <div className="qic-card" style={{ padding: 12, marginBottom: 16, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Hi {userName}!
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
            {userVulnerabilities.length > 0 
              ? `Based on your vulnerabilities (${userVulnerabilities.join(', ')}), we'll tailor recommendations just for you.`
              : 'Tell us about your scenario and we\'ll recommend the best insurance plans.'}
          </div>
        </div>
      )}
      <div className="qic-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{t('showcase.title') || 'AI Simulate'}</div>
        <div style={{ fontSize: 14, color: 'var(--qic-muted)' }}>
          {t('showcase.description') || 'Describe your insurance scenario and get personalized recommendations'}
        </div>
        <label>
          {t('showcase.category') || 'Category'}
          <select value={category} onChange={(e)=> setCategory(e.target.value)}>
            <option value="">Auto</option>
            <option value="car">Car</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="travel">Travel</option>
            <option value="home">Home</option>
            <option value="boat">Boat</option>
            <option value="medical">Medical</option>
          </select>
        </label>
        <label>
          {t('showcase.describePlan') || 'Describe your scenario or plan'}
          <textarea 
            rows={4} 
            placeholder={t('showcase.placeholder') || 'e.g., Planning a Schengen trip in May; need visa-compliant cover and baggage protection.'} 
            value={scenarioText} 
            onChange={(e)=> { 
              setScenarioText(e.target.value);
              setIsDefaultButton(false); // Mark as custom input when user types
            }} 
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onPlanScenarioSubmit} disabled={loading || !scenarioText.trim()}>{loading ? t('scenarios.simulating') : (t('simulate') || 'Simulate')}</button>
          <button onClick={()=>{ 
            const scenario = defaultScenarios[0];
            setScenarioText(scenario.text); 
            setCategory(scenario.category);
            setIsDefaultButton(true);
          }}>{t('showcase.suggest1') || 'Road trip (car)'}</button>
          <button onClick={()=>{ 
            const scenario = defaultScenarios[1];
            setScenarioText(scenario.text); 
            setCategory(scenario.category);
            setIsDefaultButton(true);
          }}>{t('showcase.suggest2') || 'Schengen winter (travel)'}</button>
          <button onClick={()=>{ 
            const scenario = defaultScenarios[2];
            setScenarioText(scenario.text); 
            setCategory(scenario.category);
            setIsDefaultButton(true);
          }}>{t('showcase.suggest3') || 'New apartment (home)'}</button>
        </div>
      </div>

      {(result || planResults.length > 0) && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('showcase.prediction')}</h3>
          {result && (
            <>
              {result.narrative && <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.narrative}</p>}
              
              {/* Scenarios Section - ALWAYS DISPLAY (even if empty) */}
              <div style={{ marginTop: 16, padding: 12, background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', borderRadius: 8, border: '2px solid #2196f3' }}>
                <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#1565c0' }}>
                  ⚠️ Scenarios You Might Encounter (with LifeScore Impact)
                </h4>
                {result.scenarios && Array.isArray(result.scenarios) && result.scenarios.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
                    {result.scenarios.map((scenario: string, idx: number) => {
                      // Extract LifeScore impact if embedded in scenario text (format: "text - LifeScore impact: -X" or "-X LifeScore")
                      const lifescoreMatch = scenario.match(/LifeScore\s*(?:impact)?\s*[:\-]\s*-?(\d+)/i) || scenario.match(/-(\d+)\s*LifeScore/i);
                      const lifescoreImpact = lifescoreMatch ? parseInt(lifescoreMatch[1], 10) : null;
                      const cleanScenario = lifescoreMatch ? scenario.replace(/LifeScore\s*(?:impact)?\s*[:\-]\s*-?\d+/i, '').replace(/-?\d+\s*LifeScore/i, '').trim() : scenario;
                      
                      return (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'start', 
                          gap: 8,
                          padding: 8,
                          background: 'white',
                          borderRadius: 6,
                          border: '1px solid #90caf9'
                        }}>
                          <span style={{ fontSize: 14, marginTop: 2, color: '#1976d2' }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, lineHeight: 1.6, color: '#333' }}>{cleanScenario}</span>
                            {lifescoreImpact !== null && (
                              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#d32f2f' }}>
                                LifeScore Impact: <strong>-{lifescoreImpact}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 14 }}>
                    Scenarios are being analyzed... If scenarios don't appear, please ensure the AI API is configured correctly.
                  </div>
                )}
              </div>
              
              {result.severity_score !== undefined && (
                <div style={{ marginTop: 12, padding: 8, background: 'var(--qic-surface)', borderRadius: 6 }}>
                  <strong>Scenario Severity: {result.severity_score}/10</strong>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {result.severity_score >= 8 ? 'High urgency - immediate action recommended' :
                     result.severity_score >= 5 ? 'Medium urgency - plan ahead' :
                     'Low urgency - consider for future planning'}
                  </div>
                </div>
              )}
              
              {result.best_plan && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <h4 style={{ margin: 0 }}>{t('showcase.bestMatch') || 'Best Match for Your Scenario'}</h4>
                    <span style={{ 
                      fontSize: 12, 
                      padding: '4px 8px', 
                      background: 'var(--qic-secondary)', 
                      color: 'white', 
                      borderRadius: 12,
                      fontWeight: 600
                    }}>
                      TOP RECOMMENDATION
                    </span>
                  </div>
                  {(() => {
                    const p = result.best_plan;
                    const isExpanded = expandedPlanIndex === 0;
                    const lifescoreImpact = calculateLifescoreImpact(result.severity_score || 5);
                    const scenarios = result.scenarios || [];
                    
                    return (
                      <Collapsible.Root open={isExpanded} onOpenChange={(open) => setExpandedPlanIndex(open ? 0 : null)}>
                        <div className="qic-card" style={{ padding: 16, cursor: 'pointer', border: isExpanded ? '3px solid var(--qic-secondary)' : '2px solid var(--qic-primary)', transition: 'all 0.2s', background: isExpanded ? '#f8f9fa' : 'white' }}>
                          <Collapsible.Trigger style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <b style={{ fontSize: 20, color: 'var(--qic-primary)' }}>{p.plan_name}</b>
                                  <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>· {p.insurance_type || p.plan_type}</span>
                                </div>
                                <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4, lineHeight: 1.5 }}>{p.description}</div>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--qic-accent)' }}>
                                  {p.relevance_score}/10
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.7 }}>Relevance</div>
                                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--qic-secondary)' }}>
                                  {isExpanded ? '▼ Less' : '▶ More Details'}
                                </div>
                              </div>
                            </div>
                              
                              {/* Quick Summary - Always Visible */}
                              {p.scenario_logic && (
                                <div style={{ marginTop: 8, padding: 8, background: '#f0f7ff', borderLeft: '3px solid var(--qic-secondary)', borderRadius: 4, fontSize: 12, lineHeight: 1.4 }}>
                                  <strong style={{ color: 'var(--qic-primary)' }}>Coverage Logic:</strong>
                                  <div style={{ marginTop: 2 }}>{p.scenario_logic}</div>
                                </div>
                              )}
                              
                              {p.profile_discount && (
                                <div style={{ marginTop: 8, padding: 6, background: '#fff3cd', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#856404' }}>
                                  🎁 {p.profile_discount}
                                </div>
                              )}
                          </Collapsible.Trigger>
                          
                          {/* Expanded Content */}
                          <Collapsible.Content style={{ marginTop: 12 }}>
                              {/* LifeScore Impact */}
                              {scenarios.length > 0 && (
                                <div style={{ marginTop: 12, padding: 12, background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', borderRadius: 8, border: '2px solid #ef5350' }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#c62828', marginBottom: 8 }}>
                                    ⚠️ Potential LifeScore Impact Without This Coverage
                                  </div>
                                  <div style={{ fontSize: 13, marginBottom: 8, color: '#c62828' }}>
                                    If scenarios occur without coverage: <strong>-{Math.abs(lifescoreImpact)} LifeScore</strong>
                                  </div>
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    <strong>Scenarios where you might need this:</strong>
                                    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                                      {scenarios.slice(0, 3).map((scenario: string, sIdx: number) => (
                                        <li key={sIdx} style={{ marginBottom: 4 }}>
                                          {scenario}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                              
                              {/* Coverage Breakdown - Feature by Feature */}
                              {p.standard_coverages && Array.isArray(p.standard_coverages) && p.standard_coverages.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                  <strong style={{ fontSize: 16, color: 'var(--qic-primary)', fontWeight: 700 }}>
                                    📋 Coverage Breakdown: Scenarios Where You Might Need Each Feature
                                  </strong>
                                  <div style={{ marginTop: 12, display: 'grid', gap: 16 }}>
                                    {p.standard_coverages.map((cov: any, i: number) => {
                                      const coverageItem = typeof cov === 'string' ? cov : (cov.item || 'Coverage');
                                      const coverageLimit = typeof cov === 'string' ? null : (cov.limit || null);
                                      const coverageDescription = typeof cov === 'string' ? '' : (cov.description || '');
                                      
                                      // Find matching scenario from coverage_scenarios array
                                      const coverageScenario = p.coverage_scenarios?.find((cs: any) => 
                                        cs.coverage_item === coverageItem ||
                                        cs.coverage_item?.toLowerCase() === coverageItem.toLowerCase()
                                      );
                                      
                                      return (
                                        <div key={i} style={{ 
                                          padding: 14, 
                                          background: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
                                          border: '2px solid var(--qic-secondary)',
                                          borderRadius: 8
                                        }}>
                                          <div style={{ marginBottom: 8 }}>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--qic-primary)', marginBottom: 4 }}>
                                              {i + 1}. {coverageItem}
                                              {coverageLimit && coverageLimit !== 'Not specified' && (
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--qic-muted)', marginLeft: 8 }}>
                                                  (Limit: {coverageLimit})
                                                </span>
                                              )}
                                            </div>
                                            {coverageDescription && (
                                              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 1.4 }}>
                                                {coverageDescription}
                                              </div>
                                            )}
                                          </div>
                                          
                                          {coverageScenario ? (
                                            <>
                                              <div style={{ 
                                                padding: 10, 
                                                background: '#e3f2fd', 
                                                borderRadius: 6, 
                                                marginBottom: 8,
                                                borderLeft: '3px solid #2196f3'
                                              }}>
                                                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#1565c0' }}>
                                                  <strong>Scenario:</strong> {coverageScenario.scenario}
                                                </div>
                                              </div>
                                              {coverageScenario.lifescore_impact && (
                                                <div style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: 8,
                                                  padding: 8,
                                                  background: '#ffebee',
                                                  borderRadius: 6,
                                                  border: '1px solid #ef5350'
                                                }}>
                                                  <span style={{ fontSize: 16 }}>⚠️</span>
                                                  <div>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828' }}>
                                                      LifeScore Impact:
                                                    </div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#c62828' }}>
                                                      -{coverageScenario.lifescore_impact}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                                              Coverage details available - contact for specific scenario analysis
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Plan Scenarios - 3 scenarios with LifeScore impacts */}
                              {p.plan_scenarios && Array.isArray(p.plan_scenarios) && p.plan_scenarios.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                  <strong style={{ fontSize: 16, color: 'var(--qic-primary)', fontWeight: 700, marginBottom: 12, display: 'block' }}>
                                    🎯 3 Scenarios: Where This Plan Would Help You
                                  </strong>
                                  <div style={{ display: 'grid', gap: 12 }}>
                                    {p.plan_scenarios.slice(0, 3).map((ps: any, idx: number) => {
                                      const hasCoverage = ps.lifescore_with_coverage || 0;
                                      const withoutCoverage = ps.lifescore_without_coverage || 0;
                                      const netBenefit = hasCoverage + Math.abs(withoutCoverage);
                                      
                                      return (
                                        <div 
                                          key={idx}
                                          style={{
                                            padding: 14,
                                            background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                                            border: '2px solid #4caf50',
                                            borderRadius: 8,
                                            position: 'relative'
                                          }}
                                        >
                                          <div style={{ marginBottom: 8 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', marginBottom: 4 }}>
                                              Scenario {idx + 1}: {ps.feature || 'Coverage Feature'}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>
                                              {ps.scenario || 'This plan would help protect you in this scenario.'}
                                            </div>
                                          </div>
                                          
                                          <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid #81c784' }}>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>With Coverage:</div>
                                              <div style={{ fontSize: 16, fontWeight: 700, color: '#2e7d32' }}>
                                                +{hasCoverage} LifeScore
                                              </div>
                                              <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>Protected from loss</div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Without Coverage:</div>
                                              <div style={{ fontSize: 16, fontWeight: 700, color: '#c62828' }}>
                                                {withoutCoverage} LifeScore
                                              </div>
                                              <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>Potential loss</div>
                                            </div>
                                            <div style={{ flex: 1, textAlign: 'right' }}>
                                              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Net Benefit:</div>
                                              <div style={{ fontSize: 18, fontWeight: 700, color: '#1b5e20' }}>
                                                +{netBenefit}
                                              </div>
                                              <div style={{ fontSize: 10, color: '#666' }}>LifeScore saved</div>
                                            </div>
                                          </div>
                                          
                                          {ps.severity && (
                                            <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                                              Severity: {ps.severity}/10
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Optional Add-ons */}
                              {p.optional_add_ons && Array.isArray(p.optional_add_ons) && p.optional_add_ons.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                  <strong style={{ fontSize: 13, color: 'var(--qic-secondary)' }}>✨ Optional Add-ons Available:</strong>
                                  <ul style={{ paddingLeft: 20, marginTop: 6, fontSize: 12 }}>
                                    {p.optional_add_ons.map((addon: any, i: number) => (
                                      <li key={i} style={{ marginBottom: 4, lineHeight: 1.4 }}>
                                        {typeof addon === 'string' ? addon : (addon.item || addon.description || '')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              <div style={{ marginTop: 12, padding: 10, background: 'var(--qic-surface)', borderRadius: 6, fontSize: 12 }}>
                                <div style={{ marginBottom: 4 }}>
                                  <strong>Qatar Compliance:</strong> {p.qatar_compliance || 'Standard QIC coverage'}
                                </div>
                                <div>
                                  <strong>Estimated Premium:</strong> {p.estimated_premium || 'Contact for quote'}
                                </div>
                              </div>
                              
                              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const planId = p.plan_id || p.plan_name;
                                    if (isInCart(planId)) {
                                      toast?.info?.('Already in cart', `${p.plan_name} is already in your cart`);
                                    } else {
                                      addToCart({
                                        plan_id: planId,
                                        plan_name: p.plan_name,
                                        insurance_type: p.insurance_type,
                                        plan_type: p.plan_type,
                                        description: p.description,
                                        estimated_premium: p.estimated_premium,
                                        relevance_score: p.relevance_score,
                                        standard_coverages: p.standard_coverages,
                                        optional_add_ons: p.optional_add_ons,
                                        scenarios: result?.scenarios,
                                        coverage_scenarios: p.coverage_scenarios
                                      });
                                      toast?.success?.('Added to cart', `${p.plan_name} added to your insurance cart`);
                                      try { track('cart_add', { plan_id: planId, plan_name: p.plan_name }); } catch {}
                                    }
                                  }}
                                  style={{
                                    padding: '10px 16px',
                                    background: isInCart(p.plan_id || p.plan_name) ? 'var(--qic-accent)' : 'var(--qic-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}
                                >
                                  <span>{isInCart(p.plan_id || p.plan_name) ? '✓' : '🛒'}</span>
                                  <span>{isInCart(p.plan_id || p.plan_name) ? (t('cart.inCart') || 'In Cart') : (t('cart.addToCart') || 'Add to Cart')}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuoteProductId(p.plan_id || p.plan_name);
                                    setQuoteOpen(true);
                                    try { track('plan_quote_click', { plan_id: p.plan_id, plan_name: p.plan_name, insurance_type: p.insurance_type }); } catch {}
                                  }}
                                  style={{
                                    padding: '10px 16px',
                                    background: 'var(--qic-secondary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--qic-primary)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--qic-secondary)';
                                  }}
                                >
                                  📞 Get Quote
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    try { track('plan_explore', { plan_id: p.plan_id, plan_name: p.plan_name }); } catch {}
                                    setSelectedPlanForDetail({
                                      plan: p,
                                      scenarioText: result?.scenario_description || scenarioText,
                                      isAIGenerated: true
                                    });
                                  }}
                                  style={{
                                    padding: '10px 16px',
                                    background: 'transparent',
                                    color: 'var(--qic-secondary)',
                                    border: '1px solid var(--qic-secondary)',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {t('showcase.explore') || 'Explore'}
                                </button>
                              </div>
                          </Collapsible.Content>
                        </div>
                      </Collapsible.Root>
                    );
                  })()}
                </div>
              )}
              
              {/* Profile Discounts Section */}
              {result.profile_discounts && Array.isArray(result.profile_discounts) && result.profile_discounts.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)', borderRadius: 8 }}>
                  <h4 style={{ marginBottom: 8, fontSize: 16, fontWeight: 600 }}>🎁 Exclusive Discounts Available</h4>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {result.profile_discounts.map((discount: any, idx: number) => (
                      <div key={idx} style={{ fontSize: 13, lineHeight: 1.5 }}>
                        <strong>{discount.qualification}</strong> {discount.discount}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {planResults.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <h4>{t('showcase.recommendedPlans') || 'Recommended Plans'}</h4>
              {planResults
                .filter((p: any) => p && (p.fullName || p.name || p.plan_name)) // Filter out invalid plans
                .map((p:any, idx:number) => (
                <div key={idx} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                      <div><b>{p.fullName || p.name || p.plan_name || 'Plan'}</b> · {p.type || 'Insurance'}</div>
                      <div style={{ opacity: 0.8 }}>{p.conciseDescription || p.description || ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const planId = p.id || p.plan_id || p.fullName || p.name || p.plan_name;
                          const planName = p.fullName || p.name || p.plan_name || 'Plan';
                          if (isInCart(planId)) {
                            toast?.info?.('Already in cart', `${planName} is already in your cart`);
                          } else {
                            addToCart({
                              plan_id: planId,
                              plan_name: planName,
                              insurance_type: p.type,
                              plan_type: p.type,
                              description: p.conciseDescription || p.description,
                              estimated_premium: p.estimated_premium,
                              scenarios: result?.scenarios
                            });
                            toast?.success?.('Added to cart', `${planName} added to your insurance cart`);
                            try { track('cart_add', { plan_id: planId, plan_name: planName }); } catch {}
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          background: isInCart(p.id || p.plan_id || p.fullName || p.name || p.plan_name) ? 'var(--qic-accent)' : 'var(--qic-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {isInCart(p.id || p.plan_id || p.fullName || p.name || p.plan_name) ? '✓ In Cart' : '🛒 Add to Cart'}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuoteProductId(p.id || p.plan_id || p.fullName || p.name || p.plan_name);
                          setQuoteOpen(true);
                          try { track('plan_quote_click', { type: p.type, name: p.fullName || p.name || p.plan_name }); } catch {}
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--qic-secondary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📞 Quote
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          try { track('plan_view', { type: p.type, name: p.fullName || p.name || p.plan_name }); } catch {}
                          setSelectedPlanForDetail({
                            plan: p,
                            scenarioText: scenarioText,
                            isAIGenerated: false
                          });
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          color: 'var(--qic-secondary)',
                          border: '1px solid var(--qic-secondary)',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {t('showcase.explore') || 'Explore'}
                      </button>
                    </div>
                  </div>
                  {Array.isArray(p.keyFeatures) && p.keyFeatures.length > 0 && (
                    <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                      {p.keyFeatures.slice(0,3).map((f:string, i:number)=>(<li key={i}>{f}</li>))}
                    </ul>
                  )}
                  {(() => {
                    const tips = getTipsForPlanType(p.type || '');
                    return Array.isArray(tips) && tips.length > 0 ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {tips.map((tip, i) => (
                          <span key={i} className="qic-card" style={{ padding: '4px 8px', fontSize: 12 }}>{tip.title}: {tip.detail}</span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {(Array.isArray(planDiscounts) && planDiscounts.length > 0) && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {planDiscounts.map((d:any, i:number)=>(
                        <button key={i} className="qic-card" style={{ padding: '2px 6px', fontSize: 11, background: 'var(--qic-accent)' }} title={d.rationale}
                          onClick={()=>{ try { track('discount_click', { kind: d.kind, label: d.label }); } catch {};
                            if (d.kind === 'first_time') window.location.href = '/rewards';
                            if (d.kind === 'nationality') window.open('https://www.gco.gov.qa/en/','_blank');
                          }}
                      >{d.label}</button>
                    ))}
                  </div>
                  )}
                  
                  {/* Plan Scenarios for recommended plans - Show 3 scenarios */}
                  {p.plan_scenarios && Array.isArray(p.plan_scenarios) && p.plan_scenarios.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ fontSize: 13, color: 'var(--qic-primary)', marginBottom: 8, display: 'block' }}>
                        🎯 3 Scenarios: Where This Plan Helps
                      </strong>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {p.plan_scenarios.slice(0, 3).map((ps: any, idx: number) => {
                          const hasCoverage = ps.lifescore_with_coverage || 0;
                          const withoutCoverage = ps.lifescore_without_coverage || 0;
                          const netBenefit = hasCoverage + Math.abs(withoutCoverage);
                          
                          return (
                            <div 
                              key={idx}
                              style={{
                                padding: 10,
                                background: '#f1f8e9',
                                border: '1px solid #81c784',
                                borderRadius: 6,
                                fontSize: 11
                              }}
                            >
                              <div style={{ fontWeight: 600, marginBottom: 4, color: '#2e7d32' }}>
                                {ps.feature || 'Coverage'} - Scenario {idx + 1}
                              </div>
                              <div style={{ color: '#666', marginBottom: 6, lineHeight: 1.4, fontSize: 10 }}>
                                {ps.scenario || 'This plan would help protect you.'}
                              </div>
                              <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                                <span style={{ color: '#2e7d32', fontWeight: 600 }}>+{hasCoverage} with</span>
                                <span style={{ color: '#c62828', fontWeight: 600 }}>{withoutCoverage} without</span>
                                <span style={{ color: '#1b5e20', fontWeight: 700 }}>+{netBenefit} saved</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {result && result.suggested_missions && Array.isArray(result.suggested_missions) && result.suggested_missions.length > 0 && (
            <>
              <h4>{t('missions.suggested')}</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {result.suggested_missions.map((m: any) => (
                  <div key={m.id} className="qic-card" style={{ padding: 12, position: 'relative' }}>
                    {Array.isArray((profile as any)?.userProfile?.profile_json?.preferences?.interests) && (profile as any).userProfile.profile_json.preferences.interests.includes((m.category||'').toLowerCase()) && (
                      <div aria-label="AI Pick" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--qic-secondary)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 6 }}>{t('ai.pickLabel')}</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                        <div>{t('showcase.rewardSummary', { xp: m.xp_reward, lifescore: m.lifescore_impact })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onStartMission(m.id)} disabled={loading}>{t('start')}</button>
                        <button onClick={() => onCompleteMission(m.id)} disabled={loading}>{t('complete')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      )}

      {recommendations && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('ai.insights')}</h3>
          <ul style={{ paddingLeft: 16 }}>
            {recommendations.insights?.map((i: any, idx: number) => (
              <li key={idx}>
                <b>{i.title}</b>: {i.detail}
                <span style={{ opacity: 0.7 }}> {t('showcase.confidence', { percent: Math.round((i.confidence || 0) * 100) })}</span>
              </li>
            ))}
          </ul>
          <h4>{t('showcase.adaptive')}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {recommendations.suggested_missions?.map((m: any) => (
              <div key={m.id} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                    <div>{t('showcase.rewardSummary', { xp: m.xp_reward, lifescore: m.lifescore_impact })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStartMission(m.id)} disabled={loading}>{t('start')}</button>
                    <button onClick={() => onCompleteMission(m.id)} disabled={loading}>{t('complete')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coins status (UI-only) */}
        <div className="qic-card" style={{ padding: 16 }}>
        <h3>{t('showcase.status')}</h3>
        <div>Coins: <b>{coins}</b></div>
        <div>{t('stats.xp')}: <b>{profile?.stats?.xp ?? profile?.user?.xp ?? 0}</b></div>
        <div>{t('stats.level')}: <b>{profile?.stats?.level ?? profile?.user?.level ?? 1}</b></div>
        </div>

      <QuoteDrawer open={quoteOpen} onClose={() => { setQuoteOpen(false); setQuoteProductId(undefined); }} productId={quoteProductId} />
      
      {/* Plan Detail View */}
      {selectedPlanForDetail && (
        <PlanDetailView
          open={!!selectedPlanForDetail}
          onClose={() => setSelectedPlanForDetail(null)}
          plan={selectedPlanForDetail.plan}
          userProfile={profile}
          scenarioText={selectedPlanForDetail.scenarioText}
          isAIGenerated={selectedPlanForDetail.isAIGenerated}
        />
      )}
    </MajlisLayout>
  );
}

