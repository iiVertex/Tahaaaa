import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load QIC terms for bundle discounts
let qicTerms = null;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const qicTermsPath = join(__dirname, '../../src/data/qic-terms.json');
  qicTerms = JSON.parse(readFileSync(qicTermsPath, 'utf-8'));
} catch (error) {
  logger.warn('Failed to load QIC terms, using defaults', { error: error?.message });
  qicTerms = {
    bundle_discounts: {
      two_products: { discount_percentage: 10 },
      three_products: { discount_percentage: 15 },
      four_plus_products: { discount_percentage: 20 },
      preferred_combinations: {
        car_home: { discount: 12 },
        car_travel: { discount: 11 },
        health_family: { discount: 25 }
      }
    }
  };
}

// Expanded QIC product catalog with realistic pricing (QAR/month)
const CATALOG = [
  { id: 'car_comprehensive', name: 'QIC Comprehensive Car Insurance', type: 'car', base_premium: 2500, category: 'car', description: 'Full coverage with agency repair for vehicles 1-3 years old' },
  { id: 'car_tpl', name: 'QIC Third Party Liability (TPL)', type: 'car', base_premium: 800, category: 'car', description: 'Basic TPL coverage as required by Qatari law' },
  { id: 'motorcycle_basic', name: 'QIC Motorcycle Insurance', type: 'motorcycle', base_premium: 1200, category: 'motorcycle', description: 'Motorcycle coverage with TPL compliance' },
  { id: 'travel_schengen', name: 'QIC Schengen Travel Insurance', type: 'travel', base_premium: 450, category: 'travel', description: 'Visa-compliant coverage for Schengen countries (EUR 30,000 minimum)' },
  { id: 'travel_annual', name: 'QIC Annual Multi-Trip Travel', type: 'travel', base_premium: 1800, category: 'travel', description: 'Annual multi-trip policy with 20% discount vs single trips' },
  { id: 'home_contents', name: 'QIC Home Contents Insurance', type: 'home', base_premium: 1200, category: 'home', description: 'Comprehensive contents coverage for apartments and villas' },
  { id: 'home_comprehensive', name: 'QIC Home Building + Contents', type: 'home', base_premium: 2800, category: 'home', description: 'Full building and contents coverage' },
  { id: 'boat_basic', name: 'QIC Boat Insurance', type: 'boat', base_premium: 3500, category: 'boat', description: 'Basic boat coverage with third-party liability' },
  { id: 'medical_basic', name: 'QIC Health Insurance Basic', type: 'medical', base_premium: 1500, category: 'medical', description: 'Basic health coverage with Qatar Health Card integration' },
  { id: 'medical_family', name: 'QIC Family Health Insurance', type: 'medical', base_premium: 4000, category: 'medical', description: 'Family health coverage with 25% discount vs individual policies' }
];

export class ProductService {
  constructor(deps = {}) {
    this.profileService = deps.profile;
  }

  getCatalog() {
    // Return catalog with realistic QIC products
    return CATALOG.map(p => ({
      ...p,
      base_premium: p.base_premium || 0, // Ensure base_premium is set
      eligible: true // All products are eligible, filtering happens elsewhere
    }));
  }

  async getEligibleProducts(userId) {
    let profileData = {};
    try {
      if (this.profileService && userId) {
        const composite = await this.profileService.getProfile(userId);
        profileData = composite?.userProfile?.profile_json || {};
      }
    } catch (error) {
      logger.warn('ProductService.getEligibleProducts profile fetch failed', { error: error?.message });
    }

    const drivingHabits = profileData?.step1?.driving_habits || 'moderate';
    const familySize = profileData?.step3?.family_size || 1;
    const coverageTypes = profileData?.step5?.coverage_types || [];

    return CATALOG.map((p) => {
      let eligible = true;
      if (p.type === 'auto' && drivingHabits === 'aggressive') eligible = false;
      if (p.type === 'home' && familySize < 1) eligible = false;
      if (p.type === 'travel' && !(coverageTypes.includes('travel') || coverageTypes.length === 0)) eligible = true;
      return { ...p, eligible };
    });
  }

  /**
   * Calculate coins discount: 1% per 500 coins (capped at 20%)
   * @param {number} userCoins - User's current coin balance
   * @returns {number} Discount percentage (0-20)
   */
  calculateCoinsDiscount(userCoins = 0) {
    const coinsDiscountPercent = Math.min(20, Math.floor(userCoins / 500) * 1);
    return coinsDiscountPercent;
  }

  calculateBundleSavings(productIds, userCoins = null) {
    const selected = CATALOG.filter((p) => Array.isArray(productIds) ? productIds.includes(p.id) : false);
    const subtotal = selected.reduce((s, p) => s + (p.base_premium || 0), 0);
    const count = selected.length;
    
    // Calculate discount using QIC terms
    const bundleRules = qicTerms?.bundle_discounts || {};
    let bundleDiscountPercent = 0;
    
    // Check for preferred combinations first
    const productTypes = selected.map(p => p.type || p.category).filter(Boolean);
    if (productTypes.includes('car') && productTypes.includes('home')) {
      bundleDiscountPercent = bundleRules.preferred_combinations?.car_home?.discount || 12;
    } else if (productTypes.includes('car') && productTypes.includes('travel')) {
      bundleDiscountPercent = bundleRules.preferred_combinations?.car_travel?.discount || 11;
    } else if (productTypes.includes('medical') && selected.some(p => p.id.includes('family'))) {
      bundleDiscountPercent = bundleRules.preferred_combinations?.health_family?.discount || 25;
    } else {
      // Use standard bundle discounts
      if (count >= 4) {
        bundleDiscountPercent = bundleRules.four_plus_products?.discount_percentage || 20;
      } else if (count === 3) {
        bundleDiscountPercent = bundleRules.three_products?.discount_percentage || 15;
      } else if (count === 2) {
        bundleDiscountPercent = bundleRules.two_products?.discount_percentage || 10;
      }
    }
    
    // Calculate coins discount (additive)
    const coinsDiscountPercent = userCoins !== null ? this.calculateCoinsDiscount(userCoins) : 0;
    
    // Combined discount (additive)
    const totalDiscountPercent = bundleDiscountPercent + coinsDiscountPercent;
    
    // Calculate savings separately for transparency
    const bundleSavingsAmount = Math.round(subtotal * (bundleDiscountPercent / 100));
    const coinsSavingsAmount = Math.round(subtotal * (coinsDiscountPercent / 100));
    const totalSavingsAmount = bundleSavingsAmount + coinsSavingsAmount;
    
    const total = subtotal - totalSavingsAmount;
    
    logger.info('Bundle savings calculated', { 
      productIds, 
      count, 
      bundleDiscountPercent, 
      coinsDiscountPercent,
      totalDiscountPercent,
      subtotal, 
      bundleSavingsAmount,
      coinsSavingsAmount,
      totalSavingsAmount, 
      total 
    });
    
    return { 
      subtotal, 
      savings_percent: totalDiscountPercent / 100, 
      savings_amount: totalSavingsAmount, 
      total, 
      discount_percentage: totalDiscountPercent,
      bundle_discount_percentage: bundleDiscountPercent,
      coins_discount_percentage: coinsDiscountPercent,
      bundle_savings_amount: bundleSavingsAmount,
      coins_savings_amount: coinsSavingsAmount
    };
  }

  getProductSpotlight(category) {
    const match = CATALOG.find((p) => p.category === category) || CATALOG[0];
    return { product_id: match.id, name: match.name, type: match.type };
  }
}

export default ProductService;


