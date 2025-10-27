import Joi from 'joi';

// Onboarding validation schema
export const onboardingSchema = Joi.object({
  step1: Joi.object({
    driving_habits: Joi.string().valid('safe', 'moderate', 'aggressive').required(),
    health_status: Joi.string().valid('excellent', 'good', 'fair', 'poor').required(),
    risk_tolerance: Joi.string().valid('low', 'medium', 'high').required()
  }).required(),
  
  step2: Joi.object({
    daily_routine: Joi.string().valid('sedentary', 'moderate', 'active').required(),
    exercise_frequency: Joi.number().min(0).max(7).required(),
    diet_quality: Joi.string().valid('excellent', 'good', 'fair', 'poor').required()
  }).required(),
  
  step3: Joi.object({
    dependents: Joi.number().min(0).max(10).required(),
    family_health: Joi.string().valid('excellent', 'good', 'fair', 'poor').required(),
    family_size: Joi.number().min(1).max(20).required()
  }).required(),
  
  step4: Joi.object({
    savings_goal: Joi.number().min(0).required(),
    investment_risk: Joi.string().valid('conservative', 'moderate', 'aggressive').required(),
    insurance_priority: Joi.array().items(Joi.string()).min(1).required()
  }).required(),
  
  step5: Joi.object({
    coverage_types: Joi.array().items(Joi.string()).min(1).required(),
    premium_budget: Joi.number().min(0).required(),
    deductible_preference: Joi.string().valid('low', 'medium', 'high').required()
  }).required(),
  
  step6: Joi.object({
    integrations: Joi.array()
      .items(Joi.string().valid(
        'QIC Mobile App',
        'QIC Health Portal', 
        'QIC Claims Portal',
        'QIC Rewards Program',
        'QIC Family Dashboard',
        'QIC Financial Planner'
      ))
      .length(3)
      .required()
  }).required(),
  
  step7: Joi.object({
    ai_preferences: Joi.object().optional(),
    notifications: Joi.object().optional()
  }).optional()
});

// Mission validation schemas
export const startMissionSchema = Joi.object({
  // MVP: accept non-GUID mission IDs from mock data
  missionId: Joi.string().min(1).required()
});

export const completeMissionSchema = Joi.object({
  missionId: Joi.string().min(1).required(),
  completionData: Joi.object().optional()
});

export const joinMissionSchema = Joi.object({
  missionId: Joi.string().min(1).required()
});

// Profile validation schema
export const updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30).optional(),
  avatar_url: Joi.string().uri().optional(),
  preferences: Joi.object().optional(),
  settings: Joi.object().optional()
});

// AI request validation
export const aiRecommendationSchema = Joi.object({
  context: Joi.string().max(1000).optional(),
  type: Joi.string().valid('mission', 'skill', 'scenario').optional()
});

// Generic validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    req.body = value;
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors: errorMessages
      });
    }

    req.query = value;
    next();
  };
};

// Mission query validation
export const missionQuerySchema = Joi.object({
  category: Joi.string().valid('safe_driving', 'health', 'financial_guardian', 'family_protection', 'lifestyle').optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
  status: Joi.string().valid('available', 'active', 'completed', 'locked').optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(10)
});
