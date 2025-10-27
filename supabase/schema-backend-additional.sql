-- Additional tables for QIC Backend API
-- Execute this after the main schema.sql file

-- Onboarding responses table
CREATE TABLE onboarding_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  step_number INT NOT NULL CHECK (step_number >= 1 AND step_number <= 7),
  response_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles with encrypted data
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_json JSONB NOT NULL, -- includes integrations array
  encrypted_data TEXT, -- sensitive info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_onboarding_user ON onboarding_responses(user_id);
CREATE INDEX idx_onboarding_step ON onboarding_responses(step_number);
CREATE INDEX idx_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_id ON user_sessions(session_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for additional tables
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Onboarding responses policies
CREATE POLICY "Users can view their own onboarding responses" ON onboarding_responses
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own onboarding responses" ON onboarding_responses
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- User sessions policies
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own sessions" ON user_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own sessions" ON user_sessions
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Grant necessary permissions
GRANT ALL ON onboarding_responses TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_sessions TO authenticated;

-- Insert sample data for testing
INSERT INTO users (id, email, lifescore, xp, level, streak_days, coins, language_preference, theme_preference) VALUES
('mock-user-001', 'user@qiclife.com', 1250, 750, 5, 7, 250, 'en', 'light');

-- Insert sample onboarding responses
INSERT INTO onboarding_responses (user_id, step_number, response_data) VALUES
('mock-user-001', 1, '{"driving_habits": "safe", "health_status": "good", "risk_tolerance": "medium"}'),
('mock-user-001', 2, '{"daily_routine": "moderate", "exercise_frequency": 3, "diet_quality": "good"}'),
('mock-user-001', 3, '{"dependents": 2, "family_health": "good", "family_size": 4}'),
('mock-user-001', 4, '{"savings_goal": 50000, "investment_risk": "moderate", "insurance_priority": ["health", "life"]}'),
('mock-user-001', 5, '{"coverage_types": ["health", "life", "auto"], "premium_budget": 500, "deductible_preference": "medium"}'),
('mock-user-001', 6, '{"integrations": ["QIC Mobile App", "QIC Health Portal", "QIC Rewards Program"]}'),
('mock-user-001', 7, '{"ai_preferences": {"personality": "encouraging"}, "notifications": {"missions": true, "achievements": true}}');

-- Insert sample user profile
INSERT INTO user_profiles (user_id, profile_json) VALUES
('mock-user-001', '{
  "integrations": ["QIC Mobile App", "QIC Health Portal", "QIC Rewards Program"],
  "risk_profile": {"driving_habits": "safe", "health_status": "good", "risk_tolerance": "medium"},
  "lifestyle": {"daily_routine": "moderate", "exercise_frequency": 3, "diet_quality": "good"},
  "family": {"dependents": 2, "family_health": "good", "family_size": 4},
  "financial": {"savings_goal": 50000, "investment_risk": "moderate", "insurance_priority": ["health", "life"]},
  "insurance": {"coverage_types": ["health", "life", "auto"], "premium_budget": 500, "deductible_preference": "medium"},
  "ai_profile": {
    "risk_level": "medium",
    "health_score": 75,
    "family_priority": "high",
    "financial_goals": "moderate",
    "insurance_focus": ["health", "life"],
    "integrations": ["QIC Mobile App", "QIC Health Portal", "QIC Rewards Program"],
    "ai_personality": "encouraging",
    "notification_preferences": {"missions": true, "achievements": true, "reminders": true, "social": false},
    "personalized_tips": ["Focus on building healthy habits", "Consider family protection options", "Regular health checkups are important"]
  },
  "onboarding_completed": true,
  "onboarding_completed_at": "2024-01-01T00:00:00Z"
}');

-- Insert sample session
INSERT INTO user_sessions (user_id, session_id, expires_at) VALUES
('mock-user-001', 'mock-session', NOW() + INTERVAL '24 hours');
