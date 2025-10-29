import { logger } from '../utils/logger.js';

const CATALOG = [
  { id: 'auto_plus', name: 'Auto Plus', type: 'auto', base_premium: 120, category: 'auto' },
  { id: 'home_secure', name: 'Home Secure', type: 'home', base_premium: 95, category: 'home' },
  { id: 'travel_easy', name: 'Travel Easy', type: 'travel', base_premium: 18, category: 'travel' }
];

export class ProductService {
  constructor(deps = {}) {
    this.profileService = deps.profile;
  }

  getCatalog() {
    return [...CATALOG];
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

  calculateBundleSavings(productIds) {
    const selected = CATALOG.filter((p) => Array.isArray(productIds) ? productIds.includes(p.id) : false);
    const subtotal = selected.reduce((s, p) => s + p.base_premium, 0);
    const count = selected.length;
    const savings_percent = count >= 3 ? 0.18 : count >= 2 ? 0.12 : 0;
    const savings_amount = Math.round(subtotal * savings_percent);
    const total = subtotal - savings_amount;
    return { subtotal, savings_percent, savings_amount, total };
  }

  getProductSpotlight(category) {
    const match = CATALOG.find((p) => p.category === category) || CATALOG[0];
    return { product_id: match.id, name: match.name, type: match.type };
  }
}

export default ProductService;


