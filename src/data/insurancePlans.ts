import raw from './insurancePlans.json';

export type PlanType = 'car' | 'motorcycle' | 'travel' | 'home' | 'boat' | 'medical';

export type InsurancePlan = {
  type: PlanType;
  fullName: string;
  conciseDescription: string;
  keyFeatures: string[];
  costs: Record<string, any>;
  otherFactors: Record<string, any>;
};

function normalizeType(t: string): PlanType {
  const s = t.toLowerCase();
  if (s.includes('car')) return 'car';
  if (s.includes('motorcycle')) return 'motorcycle';
  if (s.includes('travel')) return 'travel';
  if (s.includes('home')) return 'home';
  if (s.includes('boat') || s.includes('yacht')) return 'boat';
  if (s.includes('life') || s.includes('medical') || s.includes('qatarcare')) return 'medical';
  return 'home';
}

export const insurancePlans: InsurancePlan[] = (raw as any).insurance_plans.map((p: any) => ({
  type: normalizeType(p.type || p.full_name || ''),
  fullName: p.full_name,
  conciseDescription: p.concise_description,
  keyFeatures: Array.isArray(p.key_features) ? p.key_features : [],
  costs: p.costs || {},
  otherFactors: p.other_factors || {}
}));

const KEYWORDS: Record<PlanType, string[]> = {
  car: ['car', 'auto', 'vehicle', 'sedan', 'suv', 'accident', 'tpl', 'agency repair'],
  motorcycle: ['motorcycle', 'bike', 'rider', 'helmet', 'two-wheeler'],
  travel: ['travel', 'trip', 'vacation', 'visa', 'schengen', 'flight', 'baggage', 'airport'],
  home: ['home', 'house', 'apartment', 'contents', 'theft', 'flood', 'fire'],
  boat: ['boat', 'yacht', 'jet ski', 'marine', 'dhows', 'salvage'],
  medical: ['medical', 'health', 'hospital', 'inpatient', 'outpatient', 'qlm', 'insurance card']
};

export type ProfileContext = {
  nationality?: string | null;
  budgetQr?: number | null;
  preferences?: { interests?: string[] } | null;
  firstTimeBuyer?: boolean | null;
};

export function matchPlansByScenario(text: string, categoryHint?: PlanType): InsurancePlan[] {
  const lc = (text || '').toLowerCase();
  const scores = insurancePlans.map((plan) => {
    let score = 0;
    if (categoryHint && plan.type === categoryHint) score += 3;
    const kws = KEYWORDS[plan.type];
    for (const k of kws) if (lc.includes(k)) score += 1;
    // feature cues
    for (const f of plan.keyFeatures) if (lc.includes((f || '').toLowerCase())) score += 0.5;
    return { plan, score };
  });
  return scores.sort((a, b) => b.score - a.score).map((x) => x.plan);
}

export function rerankByProfile(plans: InsurancePlan[], profile: ProfileContext): InsurancePlan[] {
  const nat = (profile.nationality || '').toLowerCase();
  const budget = profile.budgetQr ?? null;
  const interests = profile.preferences?.interests || [];
  const firstTime = !!profile.firstTimeBuyer;

  return [...plans]
    .map((p) => {
      let score = 0;
      if (nat === 'qatari' && (p.type === 'car' || p.type === 'home' || p.type === 'medical')) score += 1;
      if (typeof budget === 'number') {
        if (p.type === 'car' && budget < 1200) score += 1; // lean TPL/basic
        if (p.type === 'travel' && budget >= 50) score += 0.5;
      }
      if (interests.includes('safe_driving') && p.type === 'car') score += 1;
      if (interests.includes('health') && (p.type === 'medical' || p.type === 'travel')) score += 0.5;
      if (firstTime) score += 0.5;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

export type Tip = { title: string; detail: string };
export function getTipsForPlanType(t: PlanType): Tip[] {
  switch (t) {
    case 'travel':
      return [
        { title: 'Timing', detail: 'Buy 7–14 days before travel for smooth visa support.' },
        { title: 'Schengen', detail: 'Ensure EUR 30,000 coverage for Schengen visas.' },
        { title: 'Add-ons', detail: 'Add winter sports or equipment cover if relevant.' }
      ];
    case 'car':
      return [
        { title: 'Agency Repair', detail: 'Use agency repair for new cars (1–3 years).' },
        { title: 'No-Claims', detail: 'Maintain no-claims to lower renewal premiums.' },
        { title: 'Eligibility', detail: 'Cars >7 years often TPL-only; check options.' }
      ];
    case 'home':
      return [
        { title: 'Contents', detail: 'Keep an inventory; consider valuables endorsement.' },
        { title: 'Unoccupancy', detail: 'Know theft cover pauses after 60 days away.' }
      ];
    case 'boat':
      return [
        { title: 'Navigation', detail: 'Confirm navigation limits; add overseas extension when needed.' },
        { title: 'Seasonal', detail: 'Plan lay-up and salvage coverage in season.' }
      ];
    case 'motorcycle':
      return [
        { title: 'Safe Riding', detail: 'Safe-riding history can unlock renewal discounts.' },
        { title: 'Total Loss', detail: 'Be aware of 70% total loss thresholds.' }
      ];
    case 'medical':
      return [
        { title: 'Network', detail: 'Check hospital network and evacuation inclusion.' },
        { title: 'Visitors', detail: 'Visitor emergency limits can be QR 150,000.' }
      ];
  }
}

export type DiscountBadge = { kind: 'seasonal' | 'nationality' | 'first_time'; label: string; rationale: string };
export function getDiscounts(profile: ProfileContext, date = new Date()): DiscountBadge[] {
  const month = date.getMonth();
  const nat = (profile.nationality || '').toLowerCase();
  const first = !!profile.firstTimeBuyer;
  const out: DiscountBadge[] = [];
  // Seasonal
  if (month === 11 || month === 0) out.push({ kind: 'seasonal', label: 'New Year 10% Online', rationale: 'Seasonal online promotion in Dec–Jan.' });
  if (month >= 5 && month <= 7) out.push({ kind: 'seasonal', label: 'Summer Travel Bundle', rationale: 'Peak travel season offers.' });
  // Nationality info
  if (nat === 'qatari') out.push({ kind: 'nationality', label: 'Check Gov Programs', rationale: 'Potential government schemes/subsidies.' });
  // First-time
  if (first) out.push({ kind: 'first_time', label: 'First-time Buyer Offer', rationale: 'Introductory discount for new customers.' });
  return out;
}


