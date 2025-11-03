import raw from './insurancePlans.json';

export type PlanType = 'car' | 'motorcycle' | 'travel' | 'home' | 'boat' | 'medical' | 'personal_accident' | 'business' | 'golf';

export type InsuranceCoverage = {
  item: string;
  limit: string;
  description: string;
};

export type InsurancePlan = {
  insurance_type: string;
  plan_name: string;
  standard_coverages: InsuranceCoverage[];
  optional_add_ons: InsuranceCoverage[];
  exclusions: InsuranceCoverage[];
};

export type InsuranceTypeGroup = {
  insurance_type: string;
  plans: InsurancePlan[];
};

function normalizeType(t: string): PlanType {
  const s = t.toLowerCase();
  if (s.includes('car')) return 'car';
  if (s.includes('motorcycle')) return 'motorcycle';
  if (s.includes('travel')) return 'travel';
  if (s.includes('home') || s.includes('contents')) return 'home';
  if (s.includes('boat') || s.includes('yacht')) return 'boat';
  if (s.includes('health') || s.includes('medical') || s.includes('qatarcare') || s.includes('visitor')) return 'medical';
  if (s.includes('personal') && s.includes('accident')) return 'personal_accident';
  if (s.includes('business') || s.includes('shield')) return 'business';
  if (s.includes('golf')) return 'golf';
  return 'home';
}

// Parse new JSON structure
export const insuranceTypes: InsuranceTypeGroup[] = Array.isArray(raw) ? raw : [];

// Flatten to plans array for backward compatibility
export const insurancePlans: InsurancePlan[] = insuranceTypes.flatMap(typeGroup => 
  typeGroup.plans.map(plan => ({
    ...plan,
    insurance_type: typeGroup.insurance_type
  }))
);

// Helper to get all insurance types
export function getAllInsuranceTypes(): string[] {
  return insuranceTypes.map(t => t.insurance_type);
}

// Helper to get plans by insurance type
export function getPlansByType(type: string): InsurancePlan[] {
  const typeGroup = insuranceTypes.find(t => 
    t.insurance_type.toLowerCase() === type.toLowerCase()
  );
  return typeGroup?.plans || [];
}

const KEYWORDS: Record<PlanType, string[]> = {
  car: ['car', 'auto', 'vehicle', 'sedan', 'suv', 'accident', 'tpl', 'agency repair', 'road trip', 'driving', 'road', 'trip'],
  motorcycle: ['motorcycle', 'bike', 'rider', 'helmet', 'two-wheeler'],
  travel: ['travel', 'trip', 'vacation', 'visa', 'schengen', 'flight', 'baggage', 'airport', 'europe', 'winter', 'skiing'],
  home: ['home', 'house', 'apartment', 'contents', 'theft', 'flood', 'fire', 'renting', 'rented', 'landlord'],
  boat: ['boat', 'yacht', 'jet ski', 'marine', 'dhows', 'salvage'],
  medical: ['medical', 'health', 'hospital', 'inpatient', 'outpatient', 'qlm', 'insurance card', 'visitor', 'visitors']
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
    const planTypeNormalized = normalizeType(plan.insurance_type || '');
    
    // STRICT: If categoryHint provided, ONLY match that category (direct relevance requirement)
    if (categoryHint) {
      if (planTypeNormalized !== categoryHint) {
        return { plan, score: 0 }; // Exclude non-relevant categories
      }
      score += 10; // High priority for exact category match
    }
    
    const kws = KEYWORDS[planTypeNormalized] || [];
    // Count keyword matches for relevance scoring
    let keywordMatches = 0;
    for (const k of kws) {
      if (lc.includes(k)) {
        score += 2; // Higher weight for keyword matches
        keywordMatches++;
      }
    }
    
    // If no keyword matches and no category hint, exclude this plan (not directly relevant)
    if (!categoryHint && keywordMatches === 0) {
      return { plan, score: 0 };
    }
    
    // Match against coverage items (lower priority)
    if (plan.standard_coverages && Array.isArray(plan.standard_coverages)) {
      for (const cov of plan.standard_coverages) {
        const covText = typeof cov === 'string' ? cov : (cov.item || cov.description || '');
        if (lc.includes(covText.toLowerCase())) score += 0.5;
      }
    }
    
    return { plan, score };
  });
  
  // Filter out zero-score plans (not directly relevant) and return top matches
  const relevantPlans = scores
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.plan);
  
  // Return max 3 directly relevant plans
  return relevantPlans.slice(0, 3);
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
export function getTipsForPlanType(t: PlanType | string): Tip[] {
  // Normalize input
  const normalized = typeof t === 'string' ? (t.toLowerCase() as PlanType) : t;
  
  switch (normalized) {
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
    default:
      // Always return an array - never undefined
      return [];
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

