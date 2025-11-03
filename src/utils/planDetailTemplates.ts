import { insurancePlans, insuranceTypes } from '@/data/insurancePlans';

export type PlanDetailContent = {
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

export function generatePlanDetailTemplate(
  plan: any,
  userProfile: any,
  scenarioText?: string
): PlanDetailContent {
  const profile = userProfile?.profile_json || userProfile || {};
  // Only use actual user data - no hardcoded defaults
  const userName = profile.name || '';
  const userAge = profile.age || null;
  const userGender = profile.gender || '';
  const userNationality = profile.nationality || '';
  const userBudget = profile.budget || null;
  const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
  const firstTimeBuyer = profile.first_time_buyer || false;

  // Find plan in insurancePlans.json
  const planName = plan.plan_name || plan.name || '';
  const insuranceType = plan.insurance_type || plan.type || '';
  
  let matchedPlan: any = null;
  for (const typeGroup of insuranceTypes) {
    const found = typeGroup.plans?.find(p => 
      p.plan_name === planName || 
      p.plan_name.toLowerCase() === planName.toLowerCase()
    );
    if (found) {
      matchedPlan = found;
      break;
    }
  }

  const standardCoverages = matchedPlan?.standard_coverages || plan.standard_coverages || [];
  const optionalAddOns = matchedPlan?.optional_add_ons || plan.optional_add_ons || [];
  const exclusions = matchedPlan?.exclusions || plan.exclusions || [];

  // Generate header - only include fields that have actual values
  const scenarioContext = scenarioText 
    ? `, ${scenarioText.substring(0, 50)}`
    : '';
  const parts = [planName, 'Personalized'];
  if (userName) parts.push(`for ${userName}`);
  
  const detailParts = [];
  if (userAge !== null && userAge !== undefined) detailParts.push(`${userAge} years old`);
  if (userGender) detailParts.push(userGender);
  if (userNationality) detailParts.push(userNationality);
  if (scenarioContext) detailParts.push(scenarioContext.replace(/^, /, ''));
  if (userBudget !== null && userBudget !== undefined && userBudget > 0) detailParts.push(`Budget ${userBudget} QAR/year`);
  
  const details = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
  const header = parts.join(' ') + details;

  // Generate welcome message
  // Generate welcome message - pass null if no actual data
  const welcomeMessage = generateWelcomeMessage(
    planName,
    insuranceType,
    userName,
    userAge,
    userGender,
    userNationality,
    scenarioText,
    firstTimeBuyer
  );

  // Generate why it fits
  const whyItFits = generateWhyItFits(
    planName,
    insuranceType,
    userAge,
    userGender,
    userNationality,
    userBudget,
    vulnerabilities,
    firstTimeBuyer,
    scenarioText
  );

  // Generate coverage table
  const coverageTable = standardCoverages.map((cov: any) => {
    const coverageItem = typeof cov === 'string' ? cov : (cov.item || '');
    const limit = typeof cov === 'string' ? 'Not specified' : (cov.limit || 'Not specified');
    const description = typeof cov === 'string' ? '' : (cov.description || '');
    
    return {
      coverageItem,
      limit,
      whatsCovered: description || `${coverageItem} coverage`,
      whyItMatters: generateWhyItMatters(coverageItem, insuranceType, userAge, userGender, userNationality, scenarioText)
    };
  });

  // Generate scenarios (3-4 scenarios based on coverages)
  const scenarios = generateScenarios(
    planName,
    insuranceType,
    standardCoverages,
    userName,
    userAge,
    userGender,
    userNationality,
    scenarioText
  );

  // Generate exclusions list
  const exclusionsList = exclusions.map((exc: any) => {
    if (typeof exc === 'string') return exc;
    return exc.description || exc.item || '';
  }).filter(Boolean);

  // Generate next steps
  const nextSteps = generateNextSteps(insuranceType, planName, firstTimeBuyer);

  // Generate contact info
  const contactInfo = generateContactInfo(userName, planName);

  return {
    header,
    welcomeMessage,
    whyItFits,
    coverageTable,
    scenarios,
    exclusions: exclusionsList,
    nextSteps,
    contactInfo
  };
}

function generateWelcomeMessage(
  planName: string,
  insuranceType: string,
  userName: string,
  userAge: number | null,
  userGender: string,
  userNationality: string,
  scenarioText?: string,
  firstTimeBuyer?: boolean
): string {
  // Only include age context if age is provided
  const ageContext = userAge !== null && userAge !== undefined 
    ? (userAge < 30 ? 'young adventurer' : userAge < 50 ? 'professional' : 'experienced')
    : '';
  const ageText = userAge !== null && userAge !== undefined ? `${userAge}-year-old ` : '';
  const scenarioContext = scenarioText 
    ? `, planning ${scenarioText.substring(0, 40)}`
    : '';
  const buyerContext = firstTimeBuyer ? 'first-time buyer' : 'customer';
  const nationalityText = userNationality || 'Qatar';
  
  const intro = userName ? `Hi ${userName},` : 'Hi there,';
  const description = ageContext 
    ? `As a ${ageText}${ageContext} from ${nationalityText}${scenarioContext}`
    : nationalityText 
      ? `As a customer from ${nationalityText}${scenarioContext}`
      : scenarioText
        ? `Planning ${scenarioText.substring(0, 40)}`
        : 'Planning your insurance needs';
  
  return `${intro}

${description}, unexpected events like emergencies or delays can turn your plans into challenges. With your active lifestyle${scenarioText ? ' and upcoming plans' : ''}, QIC's ${planName} is perfectly suited for you – it provides comprehensive protection and peace of mind for your needs. This plan is designed for ${buyerContext === 'first-time buyer' ? 'first-time buyers' : 'customers'} like you: affordable, digital (buy in minutes online), and comprehensive for emergencies.`;
}

function generateWhyItFits(
  planName: string,
  insuranceType: string,
  userAge: number,
  userGender: string,
  userNationality: string,
  userBudget: number,
  vulnerabilities: string[],
  firstTimeBuyer: boolean,
  scenarioText?: string
): string[] {
  const reasons: string[] = [];

  // Age relevance
  if (userAge < 30) {
    reasons.push(`Age & Energy Relevance: At ${userAge}, you're in a high-energy phase – think spontaneous activities or adventure add-ons. This policy covers adventure risks without age penalties.`);
  } else if (userAge >= 50) {
    reasons.push(`Age & Experience: At ${userAge}, you understand the importance of comprehensive protection. This plan offers enhanced coverage tailored for experienced customers.`);
  }

  // Scenario relevance
  if (scenarioText) {
    reasons.push(`Your Plan Context: ${scenarioText.substring(0, 60)} - This policy directly addresses the risks and needs from your scenario.`);
  }

  // Nationality relevance
  if (userNationality) {
    reasons.push(`${userNationality} Customer Perks: As a QIC customer in Qatar, you get instant digital issuance, QAR payments, and local support via WhatsApp (5000 0742). Plus, it's valid worldwide, including GCC extensions.`);
  }

  // Budget relevance
  if (userBudget > 0) {
    const costEstimate = estimateCost(insuranceType, userAge, userBudget);
    reasons.push(`Cost for You: ${costEstimate} based on your profile and budget of ${userBudget} QAR/year (get a quote at qic.online).`);
  }

  // Vulnerability relevance
  if (vulnerabilities.length > 0) {
    reasons.push(`Your Identified Needs: Your profile shows ${vulnerabilities.join(', ')} - this plan addresses these specific vulnerabilities.`);
  }

  // First-time buyer
  if (firstTimeBuyer) {
    reasons.push(`First-Time Buyer Friendly: As a first-time buyer, this plan offers straightforward coverage with no hidden complexities, perfect for getting started.`);
  }

  // Default if no specific reasons
  if (reasons.length === 0) {
    reasons.push(`Tailored Protection: This plan is specifically designed to match your profile and provide comprehensive coverage for your needs.`);
  }

  return reasons;
}

function generateWhyItMatters(
  coverageItem: string,
  insuranceType: string,
  userAge: number,
  userGender: string,
  userNationality: string,
  scenarioText?: string
): string {
  const scenarios: Record<string, string> = {
    'Third Party Liability': `If you cause an accident in ${userNationality || 'Qatar'} – no out-of-pocket costs for damages to other vehicles or property.`,
    'Own Damage': `If your vehicle sustains damage in an accident – covers repair costs, keeping you mobile.`,
    'Medical Evacuation': `If you need emergency medical transport during ${scenarioText ? scenarioText.substring(0, 30) : 'travel'} – no expensive helicopter or ambulance bills.`,
    'Emergency Medical Care': `If you need hospitalization abroad – covers expensive medical bills in foreign hospitals.`,
    'Trip Cancellation': `If ${scenarioText ? scenarioText.substring(0, 30) : 'your trip'} gets cancelled due to emergencies – reimburses non-refundable bookings.`,
    'Baggage Loss': `If your luggage gets lost during travel – replaces essential items without draining your travel budget.`
  };

  return scenarios[coverageItem] || `Protects you from financial losses related to ${coverageItem.toLowerCase()} - essential for peace of mind.`;
}

function generateScenarios(
  planName: string,
  insuranceType: string,
  standardCoverages: any[],
  userName: string,
  userAge: number,
  userGender: string,
  userNationality: string,
  scenarioText?: string
): Array<{
  title: string;
  description: string;
  lifescoreWithCoverage: number;
  lifescoreWithoutCoverage: number;
  netBenefit: number;
  savings?: string;
}> {
  const scenarios = [];
  const coverageItems = standardCoverages.slice(0, 4).map((cov: any) => 
    typeof cov === 'string' ? cov : (cov.item || '')
  );

  coverageItems.forEach((coverageItem, idx) => {
    const severity = 3 + (idx * 2); // 3, 5, 7, 9
    const lifescoreWithout = -Math.min(15, 5 + (idx * 3)); // -5, -8, -11, -14
    const lifescoreWith = Math.abs(lifescoreWithout) - 2; // +3, +6, +9, +12
    const netBenefit = lifescoreWith + Math.abs(lifescoreWithout);

    let title = '';
    let description = '';
    let savings = '';

    if (insuranceType.toLowerCase().includes('travel')) {
      title = `${coverageItem.includes('Medical') ? 'Medical Emergency' : coverageItem.includes('Trip') ? 'Trip Disruption' : 'Adventure Gone Wrong'} (Age-Relevant)`;
      description = `You're ${userAge}, exploring ${scenarioText ? scenarioText.substring(0, 30) : 'a new destination'}. A ${coverageItem.includes('Medical') ? 'medical emergency' : coverageItem.includes('Trip') ? 'flight delay' : 'lost luggage'} occurs – ${coverageItem} coverage (${typeof standardCoverages[idx] === 'object' && standardCoverages[idx].limit ? standardCoverages[idx].limit : 'fully covered'}) protects you.`;
      savings = `Savings: ${typeof standardCoverages[idx] === 'object' && standardCoverages[idx].limit ? standardCoverages[idx].limit.replace(/[^0-9]/g, '') : '5,000'}+ QAR. Without insurance, you'd drain your savings.`;
    } else if (insuranceType.toLowerCase().includes('car')) {
      title = `Accident Scenario (${userAge}-Relevant)`;
      description = `You're ${userAge}, driving in ${userNationality || 'Qatar'}. An accident occurs – ${coverageItem} coverage protects you from ${coverageItem.includes('Third Party') ? 'liability claims' : coverageItem.includes('Own Damage') ? 'repair costs' : 'financial responsibility'}.`;
      savings = `Savings: ${typeof standardCoverages[idx] === 'object' && standardCoverages[idx].limit ? standardCoverages[idx].limit : 'Significant amounts'}. Without insurance, you'd face substantial out-of-pocket expenses.`;
    } else {
      title = `${coverageItem} Protection Scenario`;
      description = `${userName} (age ${userAge}, ${userNationality || 'resident'}) might encounter a situation requiring ${coverageItem}. Having ${planName} coverage would protect you from significant financial impact.`;
      savings = `Savings: ${typeof standardCoverages[idx] === 'object' && standardCoverages[idx].limit ? standardCoverages[idx].limit : 'Protected amount'}. Without coverage, you'd face unexpected expenses.`;
    }

    scenarios.push({
      title,
      description,
      lifescoreWithCoverage: lifescoreWith,
      lifescoreWithoutCoverage: lifescoreWithout,
      netBenefit,
      savings
    });
  });

  return scenarios;
}

function generateNextSteps(
  insuranceType: string,
  planName: string,
  firstTimeBuyer: boolean
): Array<{
  step: number;
  title: string;
  description: string;
  link?: string;
}> {
  const baseUrl = 'https://qic.online';
  const typeUrl = insuranceType.toLowerCase().includes('travel') 
    ? '/en/travel-insurance'
    : insuranceType.toLowerCase().includes('car')
    ? '/en/car-insurance'
    : '/en';

  return [
    {
      step: 1,
      title: 'Get Quote',
      description: `Visit ${baseUrl}${typeUrl} – enter your details for instant pricing.`,
      link: `${baseUrl}${typeUrl}`
    },
    {
      step: 2,
      title: 'Buy & Download',
      description: `Pay QAR via card; get PDF policy emailed instantly (valid from purchase date).`,
      link: `${baseUrl}${typeUrl}`
    },
    {
      step: 3,
      title: firstTimeBuyer ? 'Visa Ready (if applicable)' : 'Secure Your Coverage',
      description: firstTimeBuyer 
        ? 'Print/email the policy – embassies accept QIC format.'
        : 'Your coverage is active immediately upon purchase.'
    },
    {
      step: 4,
      title: 'Claims?',
      description: '24/7 hotline (8000 742) or app – file digitally for fast payouts.'
    }
  ];
}

function generateContactInfo(userName: string, planName: string): string {
  return `${userName}, with QIC, your coverage is protected – focus on what matters, not the 'what-ifs'. Questions? Chat us at 5000 0742 or email support@qic.com.qa. Safe travels! *Policy details based on QIC's 2025 terms; limits/exclusions may vary. Always review full wording.*`;
}

function estimateCost(insuranceType: string, userAge: number, userBudget: number): string {
  const type = insuranceType.toLowerCase();
  if (type.includes('travel')) {
    return `QAR 50–126 for 1–2 weeks`;
  } else if (type.includes('car')) {
    const estimate = userAge < 30 ? 'QAR 800–1,500/year' : 'QAR 1,200–2,500/year';
    return estimate;
  } else if (type.includes('home')) {
    return `QAR ${Math.round(userBudget * 0.1)}–${Math.round(userBudget * 0.2)}/year`;
  }
  return `QAR ${Math.round(userBudget * 0.05)}–${Math.round(userBudget * 0.15)}/year`;
}