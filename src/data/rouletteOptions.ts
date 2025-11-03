// Nationality-based roulette wheel options
// Each nationality gets exactly 3 unique options

export interface RouletteOption {
  id: string;
  title: string;
  reward: string; // e.g., "100 QIC Coins"
  description: string;
  documentUrl: string | null; // Path to .docx file for itinerary downloads
  autoDownload: boolean; // If true, automatically download document when landed on
  color: string; // Segment color
  icon: string; // Emoji icon
}

export type NationalityType = 'Qatari' | 'Expat' | 'Visitor';

// Qatari options (3 slots: Free Insurance, Coins, Traditional Itinerary)
const qatariOptions: RouletteOption[] = [
  {
    id: 'qatari-free-insurance',
    title: '1 Month Free Insurance',
    reward: '1 Month Free on Any Insurance',
    description: 'Get one full month free on any insurance plan of your choice',
    documentUrl: null,
    autoDownload: false,
    color: '#800000', // Qatari maroon
    icon: '🎁'
  },
  {
    id: 'qatari-coins',
    title: '100 QIC Coins',
    reward: '100 QIC Coins',
    description: 'Instant reward added to your account',
    documentUrl: null,
    autoDownload: false,
    color: '#FFD700', // Gold
    icon: '🪙'
  },
  {
    id: 'qatari-itinerary',
    title: 'Traditional Qatar Itinerary',
    reward: 'Traditional Qatar Itinerary',
    description: '48-hour traditional Qatari experience guide',
    documentUrl: '/documents/itineraries/traditional-qatar.docx',
    autoDownload: false,
    color: '#444097', // QIC purple
    icon: '📖'
  }
];

// Expat options (3 slots: Free Insurance, Coins, Modern Itinerary)
const expatOptions: RouletteOption[] = [
  {
    id: 'expat-free-insurance',
    title: '1 Month Free Insurance',
    reward: '1 Month Free on Any Insurance',
    description: 'Get one full month free on any insurance plan of your choice',
    documentUrl: null,
    autoDownload: false,
    color: '#4ECDC4', // Teal
    icon: '🎁'
  },
  {
    id: 'expat-coins',
    title: '100 QIC Coins',
    reward: '100 QIC Coins',
    description: 'Instant reward added to your account',
    documentUrl: null,
    autoDownload: false,
    color: '#45B7D1', // Blue
    icon: '🪙'
  },
  {
    id: 'expat-itinerary',
    title: 'Modern Qatar Itinerary',
    reward: 'Modern Qatar Itinerary',
    description: '48-hour modern Qatari experience guide',
    documentUrl: '/documents/itineraries/modern-qatar.odt',
    autoDownload: false,
    color: '#FF6B6B', // Coral
    icon: '📖'
  }
];

// Visitor options (3 slots: Free Insurance, Coins, Futuristic Itinerary)
const visitorOptions: RouletteOption[] = [
  {
    id: 'visitor-free-insurance',
    title: '1 Month Free Insurance',
    reward: '1 Month Free on Any Insurance',
    description: 'Get one full month free on any insurance plan of your choice',
    documentUrl: null,
    autoDownload: false,
    color: '#98D8C8', // Mint
    icon: '🎁'
  },
  {
    id: 'visitor-coins',
    title: '100 QIC Coins',
    reward: '100 QIC Coins',
    description: 'Instant reward added to your account',
    documentUrl: null,
    autoDownload: false,
    color: '#F7DC6F', // Yellow
    icon: '🪙'
  },
  {
    id: 'visitor-itinerary',
    title: 'Futuristic Qatar Itinerary',
    reward: 'Futuristic Qatar Itinerary',
    description: '48-hour futuristic Qatari experience guide',
    documentUrl: '/documents/itineraries/futuristic-qatar.odt',
    autoDownload: false,
    color: '#BB8FCE', // Lavender
    icon: '📖'
  }
];

/**
 * Get roulette wheel options based on user nationality
 * Returns exactly 3 options for the specified nationality
 */
export function getRouletteOptions(nationality: string | null | undefined): RouletteOption[] {
  if (!nationality) {
    // Default to visitor if nationality not set
    return visitorOptions;
  }

  const normalizedNationality = nationality.trim();
  
  switch (normalizedNationality) {
    case 'Qatari':
      return qatariOptions;
    case 'Expat':
      return expatOptions;
    case 'Visitor':
      return visitorOptions;
    default:
      // Fallback to visitor for unknown nationalities
      return visitorOptions;
  }
}

/**
 * Find a roulette option by ID across all nationalities
 */
export function findRouletteOptionById(id: string): RouletteOption | null {
  const allOptions = [...qatariOptions, ...expatOptions, ...visitorOptions];
  return allOptions.find(opt => opt.id === id) || null;
}

