export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  useSupabase: process.env.USE_SUPABASE !== 'false' && !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  lovableApiKey: process.env.LOVABLE_API_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'local',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10)
};


