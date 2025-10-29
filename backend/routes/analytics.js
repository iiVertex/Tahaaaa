import express from 'express';
import Joi from 'joi';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { container } from '../di/container.js';

const router = express.Router();

const eventSchema = Joi.object({
  name: Joi.string().min(1).required(),
  ts: Joi.string().optional(),
  props: Joi.object().optional()
});

// In development, allow session-id only using optionalAuth
router.post('/events', (process.env.NODE_ENV !== 'production' ? optionalAuth : authenticateUser), asyncHandler(async (req, res) => {
  const session_id = req.sessionId;
  const { error, value } = eventSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(d => d.message) });

  const event = {
    user_id: req.user?.id || 'anonymous',
    event_type: value.name,
    event_data: value.props || {},
    created_at: value.ts || new Date().toISOString(),
    session_id
  };
  await container.repos.analytics.insertBehaviorEvent(event);
  logger.info('analytics_event', event);
  res.json({ success: true });
}));

router.post('/events/batch', (process.env.NODE_ENV !== 'production' ? optionalAuth : authenticateUser), asyncHandler(async (req, res) => {
  const session_id = req.sessionId;
  const { events } = req.body || {};
  if (!Array.isArray(events)) return res.status(400).json({ success: false, message: 'events array required' });
  const valid = [];
  for (const e of events) {
    const { error, value } = eventSchema.validate(e, { abortEarly: false, stripUnknown: true });
    if (!error) valid.push({
      user_id: req.user?.id || 'anonymous',
      event_type: value.name,
      event_data: value.props || {},
      created_at: value.ts || new Date().toISOString(),
      session_id
    });
  }
  await Promise.all(valid.map((ev) => container.repos.analytics.insertBehaviorEvent(ev)));
  res.json({ success: true, inserted: valid.length });
}));

router.get('/events/summary', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const summary = await container.repos.analytics.getEngagementSummary(userId);
  res.json({ success: true, data: summary });
}));

export default router;


