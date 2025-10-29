import { logger } from '../utils/logger.js';

export class MultiProductService {
  constructor(database) {
    this.db = database;
    this.memory = { purchasesByUserId: new Map() };
  }

  // Track a product purchase
  async recordPurchase(userId, purchaseData) {
    try {
      const purchase = {
        user_id: userId,
        product_id: purchaseData.product_id,
        product_type: purchaseData.product_type,
        product_name: purchaseData.product_name,
        purchase_amount: purchaseData.purchase_amount,
        currency: purchaseData.currency || 'QAR',
        policy_number: purchaseData.policy_number,
        status: 'active',
        metadata: purchaseData.metadata || {},
        purchase_date: new Date().toISOString()
      };

      if (typeof this.db?.query !== 'function') {
        // In-memory fallback
        const list = this.memory.purchasesByUserId.get(userId) || [];
        list.unshift(purchase);
        this.memory.purchasesByUserId.set(userId, list);
        
        // Update status and award (noop in fallback)
        await this.updateMultiProductStatus(userId);
        logger.info('Purchase recorded in-memory (fallback)', { userId, productId: purchaseData.product_id });
        return { success: true, data: purchase };
      }

      await this.db.query('user_purchases', { type: 'insert' }, { data: purchase });

      // Update user's multi-product status
      await this.updateMultiProductStatus(userId);

      // Award gamification rewards for purchase
      await this.awardPurchaseRewards(userId, purchaseData);

      logger.info('Purchase recorded successfully', { userId, productId: purchaseData.product_id });
      return { success: true, data: purchase };

    } catch (error) {
      logger.error('Purchase recording error:', error);
      return { success: false, message: 'Failed to record purchase' };
    }
  }

  // Get user's purchase history
  async getUserPurchases(userId) {
    try {
      if (typeof this.db?.query !== 'function') {
        const purchases = this.memory.purchasesByUserId.get(userId) || [];
        const summary = this.calculatePurchaseSummary(purchases);
        return { purchases, summary };
      }

      const purchases = await this.db.query('user_purchases', { type: 'select' }, {
        filters: { user_id: userId },
        orderBy: { column: 'purchase_date', ascending: false }
      });

      const purchaseList = Array.isArray(purchases) ? purchases : [];
      const summary = this.calculatePurchaseSummary(purchaseList);

      return { purchases: purchaseList, summary };

    } catch (error) {
      logger.error('Get user purchases error:', error);
      return { purchases: [], summary: this.getDefaultSummary() };
    }
  }

  // Calculate multi-product customer metrics
  calculatePurchaseSummary(purchases) {
    if (!purchases || purchases.length === 0) {
      return this.getDefaultSummary();
    }

    const activePurchases = purchases.filter(p => p.status === 'active');
    const uniqueProductTypes = new Set(activePurchases.map(p => p.product_type));
    const totalValue = activePurchases.reduce((sum, p) => sum + parseFloat(p.purchase_amount || 0), 0);
    
    const productTypeCounts = {};
    activePurchases.forEach(p => {
      productTypeCounts[p.product_type] = (productTypeCounts[p.product_type] || 0) + 1;
    });

    return {
      totalPurchases: activePurchases.length,
      uniqueProductTypes: uniqueProductTypes.size,
      isMultiProductCustomer: uniqueProductTypes.size > 1,
      totalValue,
      averagePurchaseValue: activePurchases.length > 0 ? totalValue / activePurchases.length : 0,
      productTypeBreakdown: productTypeCounts,
      lastPurchaseDate: activePurchases.length > 0 ? activePurchases[0].purchase_date : null,
      customerTier: this.calculateCustomerTier(uniqueProductTypes.size, totalValue)
    };
  }

  // Determine customer tier based on product diversity and value
  calculateCustomerTier(productTypeCount, totalValue) {
    if (productTypeCount >= 4 && totalValue >= 5000) return 'platinum';
    if (productTypeCount >= 3 && totalValue >= 3000) return 'gold';
    if (productTypeCount >= 2 && totalValue >= 1000) return 'silver';
    if (productTypeCount >= 1) return 'bronze';
    return 'prospect';
  }

  // Update user's multi-product status in their profile
  async updateMultiProductStatus(userId) {
    if (typeof this.db?.query !== 'function') return;

    try {
      const { summary } = await this.getUserPurchases(userId);
      
      // Update user profile with multi-product status
      await this.db.query('users', { type: 'update' }, {
        filters: { id: userId },
        data: {
          // Add multi-product fields to user profile
          multi_product_customer: summary.isMultiProductCustomer,
          customer_tier: summary.customerTier,
          total_products_purchased: summary.totalPurchases,
          last_purchase_date: summary.lastPurchaseDate
        }
      });

    } catch (error) {
      logger.error('Update multi-product status error:', error);
    }
  }

  // Award gamification rewards for purchases
  async awardPurchaseRewards(userId, purchaseData) {
    if (typeof this.db?.query !== 'function') return;

    try {
      const { summary } = await this.getUserPurchases(userId);
      
      // Award XP for purchase
      const xpReward = Math.floor(purchaseData.purchase_amount * 0.1); // 10% of purchase as XP
      
      // Award coins for purchase
      const coinReward = Math.floor(purchaseData.purchase_amount * 0.05); // 5% of purchase as coins
      
      // Award LifeScore boost for purchase
      const lifescoreBoost = Math.min(10, Math.floor(purchaseData.purchase_amount / 100)); // Up to 10 points

      // Record rewards in gamification system
      await this.db.query('user_behavior_events', { type: 'insert' }, {
        data: {
          user_id: userId,
          event_type: 'purchase_reward',
          event_data: {
            product_id: purchaseData.product_id,
            xp_reward: xpReward,
            coin_reward: coinReward,
            lifescore_boost: lifescoreBoost,
            purchase_amount: purchaseData.purchase_amount
          },
          created_at: new Date().toISOString()
        }
      });

      // Multi-product customer bonus
      if (summary.isMultiProductCustomer) {
        const multiProductBonus = 50; // Bonus XP for multi-product customers
        
        await this.db.query('user_behavior_events', { type: 'insert' }, {
          data: {
            user_id: userId,
            event_type: 'multi_product_bonus',
            event_data: {
              bonus_xp: multiProductBonus,
              product_types: summary.uniqueProductTypes
            },
            created_at: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      logger.error('Award purchase rewards error:', error);
    }
  }

  // Get cross-sell recommendations based on purchase history
  async getCrossSellRecommendations(userId) {
    try {
      const { summary } = await this.getUserPurchases(userId);
      const recommendations = [];

      // If user has no purchases, recommend basic products
      if (summary.totalPurchases === 0) {
        recommendations.push(
          { product_type: 'motor_insurance', priority: 1, reason: 'Most popular starting product' },
          { product_type: 'health_insurance', priority: 2, reason: 'Essential protection' }
        );
      } else {
        // Recommend complementary products based on existing purchases
        const ownedTypes = new Set(Object.keys(summary.productTypeBreakdown));
        
        if (!ownedTypes.has('motor_insurance')) {
          recommendations.push({ product_type: 'motor_insurance', priority: 1, reason: 'Complements your existing coverage' });
        }
        if (!ownedTypes.has('home_insurance')) {
          recommendations.push({ product_type: 'home_insurance', priority: 2, reason: 'Protect your biggest asset' });
        }
        if (!ownedTypes.has('travel_insurance')) {
          recommendations.push({ product_type: 'travel_insurance', priority: 3, reason: 'Travel with confidence' });
        }
        if (!ownedTypes.has('life_insurance')) {
          recommendations.push({ product_type: 'life_insurance', priority: 4, reason: 'Secure your family\'s future' });
        }
      }

      return {
        recommendations: recommendations.slice(0, 3), // Top 3 recommendations
        rationale: `Based on your ${summary.totalPurchases} existing product${summary.totalPurchases !== 1 ? 's' : ''}`,
        customerTier: summary.customerTier,
        isMultiProduct: summary.isMultiProductCustomer
      };

    } catch (error) {
      logger.error('Cross-sell recommendations error:', error);
      return { recommendations: [], rationale: 'Unable to generate recommendations' };
    }
  }

  // Get analytics for multi-product conversion
  async getMultiProductAnalytics() {
    if (typeof this.db?.query !== 'function') {
      return { conversionRate: 0, totalCustomers: 0, multiProductCustomers: 0 };
    }

    try {
      const allPurchases = await this.db.query('user_purchases', { type: 'select' }, {});
      const purchaseList = Array.isArray(allPurchases) ? allPurchases : [];
      
      // Group by user
      const userPurchases = {};
      purchaseList.forEach(purchase => {
        if (!userPurchases[purchase.user_id]) {
          userPurchases[purchase.user_id] = [];
        }
        userPurchases[purchase.user_id].push(purchase);
      });

      const totalCustomers = Object.keys(userPurchases).length;
      let multiProductCustomers = 0;

      Object.values(userPurchases).forEach(purchases => {
        const uniqueTypes = new Set(purchases.filter(p => p.status === 'active').map(p => p.product_type));
        if (uniqueTypes.size > 1) {
          multiProductCustomers++;
        }
      });

      const conversionRate = totalCustomers > 0 ? (multiProductCustomers / totalCustomers) * 100 : 0;

      return {
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalCustomers,
        multiProductCustomers,
        singleProductCustomers: totalCustomers - multiProductCustomers
      };

    } catch (error) {
      logger.error('Multi-product analytics error:', error);
      return { conversionRate: 0, totalCustomers: 0, multiProductCustomers: 0 };
    }
  }

  // Get default summary for fallback
  getDefaultSummary() {
    return {
      totalPurchases: 0,
      uniqueProductTypes: 0,
      isMultiProductCustomer: false,
      totalValue: 0,
      averagePurchaseValue: 0,
      productTypeBreakdown: {},
      lastPurchaseDate: null,
      customerTier: 'prospect'
    };
  }
}
