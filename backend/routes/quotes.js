import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/security.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { container } from '../di/container.js';
import { db } from '../services/supabase.js';

const quotes = new Map(); // fallback in-memory (used only if no DB available)

const router = express.Router();

router.post('/start', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { product_id, inputs } = req.body || {};
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id required' });

  // Validate product exists and user eligibility
  const productService = container.services.product;
  const catalog = productService.getCatalog();
  const product = catalog.find(p => p.id === product_id);
  if (!product) return res.status(400).json({ success: false, message: 'Invalid product_id' });
  const eligibleList = await productService.getEligibleProducts(userId);
  const elig = eligibleList.find(p => p.id === product_id);
  if (!elig || !elig.eligible) return res.status(403).json({ success: false, message: 'User not eligible for selected product' });

  // Create quote session
  const id = `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const base = product.base_premium;
  const price_range = [Math.max(50, Math.round(base * 0.7)), Math.round(base * 1.2)];
  const session = { id, user_id: userId, product_id, inputs: inputs || {}, status: 'in_progress', price_range, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 24*60*60*1000).toISOString() };

  // Persist to database if available
  if (typeof db?.query === 'function') {
    try {
      await db.query('user_quotes', { type: 'insert' }, {
        data: {
          id,
          user_id: userId,
          product_id,
          quote_data: { inputs: inputs || {}, price_range },
          status: 'in_progress',
          expires_at: session.expires_at
        }
      });
    } catch (_) {
      quotes.set(id, session);
    }
  } else {
  quotes.set(id, session);
  }
  res.json({ success: true, data: { quote_session_id: id, product_id, price_range, next_step: 'provide_details' } });
}));

router.get('/:id/status', authenticateUser, asyncHandler(async (req, res) => {
  let q = null;
  if (typeof db?.query === 'function') {
    try {
      const rows = await db.query('user_quotes', { type: 'select' }, { filters: { id: req.params.id } });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        q = {
          id: row.id,
          status: row.status,
          price_range: row.quote_data?.price_range || [],
          expires_at: row.expires_at
        };
      }
    } catch (_) {}
  }
  if (!q) {
    const mem = quotes.get(req.params.id);
    if (mem) {
      q = { id: mem.id, status: mem.status, price_range: mem.price_range, expires_at: mem.expires_at || new Date(new Date(mem.created_at).getTime() + 24*60*60*1000).toISOString() };
    }
  }
  if (!q) return res.status(404).json({ success: false, message: 'Not found' });
  const expired = new Date(q.expires_at) < new Date();
  if (expired && q.status !== 'expired') {
    if (typeof db?.query === 'function') {
      try { await db.query('user_quotes', { type: 'update' }, { filters: { id: req.params.id }, data: { status: 'expired' } }); } catch (_) {}
    } else {
      const mem = quotes.get(req.params.id);
      if (mem) mem.status = 'expired';
    }
    q.status = 'expired';
  }
  res.json({ success: true, data: { status: q.status, price_range: q.price_range, next_step: q.status === 'in_progress' ? 'review' : 'complete' } });
}));

router.post('/:id/complete', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
  let q = null;
  if (typeof db?.query === 'function') {
    try {
      const rows = await db.query('user_quotes', { type: 'select' }, { filters: { id: req.params.id } });
      q = Array.isArray(rows) ? rows[0] : null;
    } catch (_) {}
  } else {
    q = quotes.get(req.params.id);
  }
  if (!q) return res.status(404).json({ success: false, message: 'Not found' });
  const expiresAt = q.expires_at || (q.created_at ? new Date(new Date(q.created_at).getTime() + 24*60*60*1000).toISOString() : new Date().toISOString());
  const expired = new Date(expiresAt) < new Date();
  if (expired) return res.status(410).json({ success: false, message: 'Quote session expired' });
  const price_range = q.quote_data?.price_range || q.price_range || [100, 200];
  const final_price = Math.round((price_range[0] + price_range[1]) / 2);
  if (typeof db?.query === 'function') {
    try { await db.query('user_quotes', { type: 'update' }, { filters: { id: req.params.id }, data: { status: 'complete', final_price, completed_at: new Date().toISOString() } }); } catch (_) {}
  } else {
    const mem = quotes.get(req.params.id);
    if (mem) { mem.status = 'complete'; mem.final_price = final_price; }
  }
  res.json({ success: true, data: { status: 'complete', final_price } });
}));

export default router;


