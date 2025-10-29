import { z } from 'zod';

// Mission
export const MissionSchema = z.object({
  id: z.string(),
  title: z.string().or(z.string().optional()).optional(),
  title_en: z.string().optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  xp_reward: z.number().int().nonnegative().optional(),
  lifescore_impact: z.number().int().optional()
});
export type Mission = z.infer<typeof MissionSchema>;

// Scenario prediction
export const ScenarioPredictionSchema = z.object({
  narrative: z.string(),
  risk_level: z.enum(['low','medium','high']).or(z.string()),
  lifescore_impact: z.number().int(),
  xp_reward: z.number().int(),
  suggested_missions: z.array(MissionSchema).default([])
});
export type ScenarioPrediction = z.infer<typeof ScenarioPredictionSchema>;

// Reward
export const RewardSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  title_en: z.string().optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  coins_cost: z.number().int().nonnegative().optional(),
  xp_reward: z.number().int().nonnegative().optional(),
  category: z.string().optional()
});
export type Reward = z.infer<typeof RewardSchema>;

// Profile (partial)
export const ProfileSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
    username: z.string().optional(),
    lifescore: z.number().int().min(0).max(100).optional(),
    xp: z.number().int().nonnegative().optional(),
    level: z.number().int().positive().optional(),
    coins: z.number().int().nonnegative().optional()
  }).optional(),
  stats: z.object({
    lifescore: z.number().int().min(0).max(100).optional(),
    xp: z.number().int().nonnegative().optional(),
    level: z.number().int().positive().optional(),
    current_streak: z.number().int().nonnegative().optional(),
  }).partial().optional(),
  suggestions: z.array(z.any()).optional()
});
export type Profile = z.infer<typeof ProfileSchema>;

// AI recommendations
export const AIRecommendationsSchema = z.object({
  insights: z.array(z.object({
    title: z.string(),
    detail: z.string().optional(),
    confidence: z.number().optional(),
    priority: z.enum(['high','medium','low']).optional(),
    action_hint: z.string().optional(),
  })).default([]),
  suggested_missions: z.array(MissionSchema).default([])
}).extend({
  product_recommendations: z.array(z.object({
    product_id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    estimated_premium: z.number().optional(),
    savings_if_bundled: z.number().optional(),
    rationale: z.string().optional(),
    cta: z.string().optional()
  })).default([])
});
export type AIRecommendations = z.infer<typeof AIRecommendationsSchema>;

// Helpers
export function safeParseOr<T>(schema: z.ZodTypeAny, data: unknown, fallback: T): T {
  const r = schema.safeParse(data);
  return (r.success ? (r.data as T) : fallback);
}


