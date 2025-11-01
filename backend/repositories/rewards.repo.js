// Rewards repository: uses Supabase when available, else falls back to mock list
export class RewardsRepo {
  constructor(database) {
    this.db = database;
  }

  async listActive() {
    // Check if this is mock DB (no client property)
    const isMockDB = !this.db.client;
    
    if (!isMockDB && typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('rewards', { type: 'select' }, {
          filters: { is_active: true },
          orderBy: { column: 'created_at', ascending: false },
        });
        // Only return database results if we actually got some
        if (rows && Array.isArray(rows) && rows.length > 0) {
          return rows;
        }
      } catch (error) {
        // Log error but continue to fallback
        console.warn('[RewardsRepo] Database query failed, using fallback:', error.message);
      }
    }
    // Fallback mock - Comprehensive rewards catalog aligned with QIC
    return [
      // Test reward (10 coins)
      { id: 'test-reward-10', title: 'Test Reward', title_en: 'Test Reward', title_ar: 'مكافأة تجريبية', description: 'Testing reward for 10 coins', description_en: 'Testing reward for 10 coins', description_ar: 'مكافأة تجريبية بـ 10 عملات', coins_cost: 10, xp_reward: 5, type: 'partner_offer', badge_icon: 'star', badge_rarity: 'common', is_active: true, coupon_code: 'TEST10' },
      // Partner offers (realistic QIC-aligned rewards)
      { id: 'fuel-discount-10', title: 'Fuel Discount 10%', title_en: 'Fuel Discount 10%', title_ar: 'خصم الوقود 10%', description: '10% discount on fuel purchases at partner stations', description_en: '10% discount on fuel purchases at partner stations', description_ar: 'خصم 10% على مشتريات الوقود', coins_cost: 200, xp_reward: 20, type: 'partner_offer', badge_icon: 'gas-station', badge_rarity: 'rare', is_active: true, coupon_code: 'FUEL10' },
      { id: 'restaurant-voucher-50', title: 'Restaurant Voucher QR 50', title_en: 'Restaurant Voucher QR 50', title_ar: 'قسيمة مطعم 50 ريال', description: 'QR 50 voucher for partner restaurants', description_en: 'QR 50 voucher for partner restaurants', description_ar: 'قسيمة 50 ريال لمطاعم الشركاء', coins_cost: 150, xp_reward: 15, type: 'partner_offer', badge_icon: 'restaurant', badge_rarity: 'common', is_active: true, coupon_code: 'FOOD50' },
      { id: 'gym-membership-month', title: 'Gym Membership 1 Month', title_en: 'Gym Membership 1 Month', title_ar: 'عضوية صالة رياضية شهر', description: '1 month free gym membership at partner gyms', description_en: '1 month free gym membership at partner gyms', description_ar: 'عضوية صالة رياضية مجانية لمدة شهر', coins_cost: 500, xp_reward: 50, type: 'partner_offer', badge_icon: 'dumbbell', badge_rarity: 'epic', is_active: true, coupon_code: 'GYM1M' },
      { id: 'cinema-tickets-2', title: 'Cinema Tickets (2)', title_en: 'Cinema Tickets (2)', title_ar: 'تذاكر السينما (2)', description: '2 cinema tickets at partner cinemas', description_en: '2 cinema tickets at partner cinemas', description_ar: 'تذكرتين للسينما في دور العرض الشريكة', coins_cost: 250, xp_reward: 25, type: 'partner_offer', badge_icon: 'film', badge_rarity: 'rare', is_active: true, coupon_code: 'CINE2' },
      { id: 'coffee-voucher-20', title: 'Coffee Voucher QR 20', title_en: 'Coffee Voucher QR 20', title_ar: 'قسيمة قهوة 20 ريال', description: 'QR 20 voucher at partner coffee shops', description_en: 'QR 20 voucher at partner coffee shops', description_ar: 'قسيمة 20 ريال في مقاهي الشركاء', coins_cost: 80, xp_reward: 10, type: 'partner_offer', badge_icon: 'coffee', badge_rarity: 'common', is_active: true, coupon_code: 'COFFEE20' },
      { id: 'spa-voucher-100', title: 'Spa Voucher QR 100', title_en: 'Spa Voucher QR 100', title_ar: 'قسيمة سبا 100 ريال', description: 'QR 100 voucher at partner spas', description_en: 'QR 100 voucher at partner spas', description_ar: 'قسيمة 100 ريال في منتجعات الشركاء', coins_cost: 400, xp_reward: 40, type: 'partner_offer', badge_icon: 'spa', badge_rarity: 'epic', is_active: true, coupon_code: 'SPA100' },
      { id: 'retail-discount-15', title: 'Retail Discount 15%', title_en: 'Retail Discount 15%', title_ar: 'خصم تجزئة 15%', description: '15% discount at partner retail stores', description_en: '15% discount at partner retail stores', description_ar: 'خصم 15% في متاجر الشركاء', coins_cost: 300, xp_reward: 30, type: 'partner_offer', badge_icon: 'shopping', badge_rarity: 'rare', is_active: true, coupon_code: 'RETAIL15' },
      { id: 'waterpark-ticket', title: 'Waterpark Day Pass', title_en: 'Waterpark Day Pass', title_ar: 'تذكرة يومية لمنتزه مائي', description: 'Day pass to partner waterpark', description_en: 'Day pass to partner waterpark', description_ar: 'تذكرة يومية لمنتزه مائي شريك', coins_cost: 350, xp_reward: 35, type: 'partner_offer', badge_icon: 'water', badge_rarity: 'epic', is_active: true, coupon_code: 'WPARK1' },
      { id: 'car-wash-free', title: 'Free Car Wash', title_en: 'Free Car Wash', title_ar: 'غسيل سيارة مجاني', description: 'Free car wash at partner service centers', description_en: 'Free car wash at partner service centers', description_ar: 'غسيل سيارة مجاني في مراكز الخدمة الشريكة', coins_cost: 120, xp_reward: 12, type: 'partner_offer', badge_icon: 'car', badge_rarity: 'common', is_active: true, coupon_code: 'WASH1' },
      // Coin boosts
      { id: 'weekend-warrior', title: 'Weekend Warrior Boost', title_en: 'Weekend Warrior Boost', title_ar: 'تعزيز محارب نهاية الأسبوع', description: '2x coins for weekend missions', description_en: '2x coins for weekend missions', description_ar: 'ضعف العملات لمهمات نهاية الأسبوع', coins_cost: 100, xp_reward: 10, type: 'coin_boost', badge_icon: 'coins', badge_rarity: 'common', is_active: true },
      // Badges (free)
      { id: 'bronze-achiever', title: 'Bronze Achiever Badge', title_en: 'Bronze Achiever', title_ar: 'المحقق البرونزي', description: 'Complete your first mission', description_en: 'Complete your first mission', description_ar: 'أكمل مهمتك الأولى', coins_cost: 0, xp_reward: 0, type: 'badge', badge_icon: 'medal', badge_rarity: 'common', is_active: true },
      { id: 'silver-streak', title: 'Silver Streak Badge', title_en: 'Silver Streak Master', title_ar: 'سيد السلسلة الفضي', description: 'Maintain a 7-day streak', description_en: 'Maintain a 7-day streak', description_ar: 'حافظ على سلسلة لمدة 7 أيام', coins_cost: 0, xp_reward: 0, type: 'badge', badge_icon: 'trophy', badge_rarity: 'rare', is_active: true }
    ];
  }

  async getById(rewardId) {
    // Check if this is mock DB (no client property) or if query returns empty
    const isMockDB = !this.db.client;
    
    if (!isMockDB && typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('rewards', { type: 'select' }, { filters: { id: rewardId } });
        if (rows && Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      } catch (error) {
        // Fall through to mock list
      }
    }
    
    // Always check mock list (works for both mock DB and as fallback)
    const list = await this.listActive();
    const found = list.find(r => r.id === rewardId);
    return found || null;
  }
}

export default RewardsRepo;


