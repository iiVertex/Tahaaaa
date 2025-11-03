import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { db } from '../services/supabase.js';

const referrals = new Map(); // code -> stats

const router = express.Router();

router.post('/share', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const code = `QIC${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const share_url = `https://qic.life/r/${code}`;
  
  // Get context from request body (recent mission completion, challenge type, etc.)
  const context = req.body || {};
  let referralMessage = '';
  let emailSubject = 'Join QIC Life - Exclusive Insurance Rewards!';
  
  // Generate context-aware referral message
  if (context.recent_mission && context.recent_mission.name) {
    const missionName = context.recent_mission.name;
    const coins = context.recent_mission.coins || 0;
    const lifescore = context.recent_mission.lifescore || 0;
    referralMessage = `I just completed "${missionName}" with ${coins} coins and my LifeScore went up ${lifescore} points! Join QIC Life and beat me 1v1 on missions! Use my code: ${code}`;
    emailSubject = `I just completed ${missionName} on QIC Life!`;
  } else if (context.challenge) {
    referralMessage = `I'll beat you 1v1 on the QIC app missions! Log in to accept challenge. Use my code: ${code}`;
    emailSubject = 'Challenge: QIC Life Missions 1v1!';
  } else {
    // Default generic message
    referralMessage = `Join QIC Life and get exclusive insurance rewards! Use my code: ${code}`;
  }
  
  const payload = { code, shares: 1, clicks: 0, installs: 0, purchases: 0, session_id: sessionId, owner_user_id: req.user.id, created_at: new Date().toISOString() };
  let persisted = false;
  if (typeof db?.query === 'function') {
    try {
      await db.query('user_referrals', { type: 'insert' }, { data: payload });
      persisted = true;
    } catch (_) {}
  }
  if (!persisted) referrals.set(code, payload);
  res.json({ success: true, data: { code, share_url, referral_message: referralMessage, email_subject: emailSubject } });
}));

// Track referral link click
router.post('/track/:code', strictRateLimit, asyncHandler(async (req, res) => {
  const code = req.params.code;
  let updated = false;
  if (typeof db?.query === 'function') {
    try {
      const rows = await db.query('user_referrals', { type: 'select' }, { filters: { code } });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        await db.query('user_referrals', { type: 'update' }, { filters: { code }, data: { clicks: (row.clicks || 0) + 1 } });
        updated = true;
      }
    } catch (_) {}
  }
  if (!updated) {
    const entry = referrals.get(code);
  if (!entry) return res.status(404).json({ success: false, message: 'Invalid referral code' });
  entry.clicks += 1;
  }
  logger.info('referral_click', { code });
  res.json({ success: true });
}));

// Track install/conversion and award coins
router.post('/install/:code', strictRateLimit, asyncHandler(async (req, res) => {
  const code = req.params.code;
  let updated = false;
  let referralData = null;
  
  if (typeof db?.query === 'function') {
    try {
      const rows = await db.query('user_referrals', { type: 'select' }, { filters: { code } });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        referralData = row;
        await db.query('user_referrals', { type: 'update' }, { filters: { code }, data: { installs: (row.installs || 0) + 1 } });
        updated = true;
      }
    } catch (_) {}
  }
  if (!updated) {
    const entry = referrals.get(code);
  if (!entry) return res.status(404).json({ success: false, message: 'Invalid referral code' });
  entry.installs += 1;
    referralData = entry;
  }

  // Enhanced loyalty rewards based on referral performance
  const baseCoins = 50;
  const loyaltyMultiplier = referralData ? Math.min(2.0, 1 + (referralData.installs * 0.1)) : 1.0;
  const coins_awarded = Math.floor(baseCoins * loyaltyMultiplier);
  
  // Award bonus XP for successful referrals
  const xp_bonus = Math.floor(coins_awarded * 0.5);
  
  // Award LifeScore boost for referral success
  const lifescore_boost = Math.min(5, Math.floor(coins_awarded / 20));

  logger.info('referral_install', { code, coins_awarded, xp_bonus, lifescore_boost, loyaltyMultiplier });
  res.json({ 
    success: true, 
    data: { 
      coins_awarded, 
      xp_bonus, 
      lifescore_boost,
      loyalty_tier: loyaltyMultiplier > 1.5 ? 'gold' : loyaltyMultiplier > 1.2 ? 'silver' : 'bronze'
    } 
  });
}));

// Stats for current user's referral performance
router.get('/stats', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let rows = [];
  if (typeof db?.query === 'function') {
    try {
      rows = await db.query('user_referrals', { type: 'select' }, { filters: { owner_user_id: userId } });
    } catch (_) {}
  }
  const stats = rows.length ? rows : Array.from(referrals.values()).filter(r => r.owner_user_id === userId);
  const agg = stats.reduce((acc, r) => { acc.shares += r.shares||0; acc.clicks += r.clicks||0; acc.installs += r.installs||0; acc.purchases += (r.purchases || 0); return acc; }, { shares: 0, clicks: 0, installs: 0, purchases: 0 });
  res.json({ success: true, data: { ...agg, codes: stats.map(s => s.code) } });
}));

export default router;


