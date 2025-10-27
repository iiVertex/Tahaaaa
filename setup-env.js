#!/usr/bin/env node

/**
 * QIC Gamified Insurance App - Environment Setup Script
 * This script creates a .env file from the template
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envTemplate = `# QIC Gamified Insurance App - Environment Variables
# This file contains your actual API keys and configuration
# DO NOT commit this file to version control

# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_ROLE_KEY=

# ============================================================================
# AUTHENTICATION (CLERK.DEV)
# ============================================================================
VITE_CLERK_PUBLISHABLE_KEY=
VITE_CLERK_SECRET_KEY=

# ============================================================================
# AI INTEGRATION (LOVABLE.DEV)
# ============================================================================
VITE_LOVABLE_API_KEY=
VITE_LOVABLE_API_ENDPOINT=https://api.lovable.dev/v1/

# ============================================================================
# ALTERNATIVE AI PROVIDERS
# ============================================================================
VITE_OPENAI_API_KEY=
VITE_ANTHROPIC_API_KEY=

# ============================================================================
# APP CONFIGURATION
# ============================================================================
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0
VITE_APP_NAME=QIC Gamified Insurance
VITE_APP_DESCRIPTION=AI-powered gamified insurance app for QIC

# ============================================================================
# FEATURE FLAGS
# ============================================================================
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_SOCIAL_FEATURES=true
VITE_ENABLE_COLLABORATIVE_MISSIONS=true
VITE_ENABLE_SCENARIO_SIMULATIONS=true
VITE_ENABLE_REAL_TIME_NOTIFICATIONS=true

# ============================================================================
# DEVELOPMENT SETTINGS
# ============================================================================
VITE_DEBUG_MODE=false
VITE_USE_MOCK_DATA=true
VITE_ENABLE_DEV_TOOLS=true
VITE_API_BASE_URL=http://localhost:3000/api

# ============================================================================
# INTERNATIONALIZATION
# ============================================================================
VITE_DEFAULT_LANGUAGE=en
VITE_SUPPORTED_LANGUAGES=en,ar,fr,es,de,zh
VITE_ENABLE_RTL_SUPPORT=true

# ============================================================================
# THEME SETTINGS
# ============================================================================
VITE_DEFAULT_THEME=light
VITE_ENABLE_THEME_SWITCHING=true

# ============================================================================
# GAMIFICATION SETTINGS
# ============================================================================
VITE_XP_PER_LEVEL=100
VITE_MAX_LIFESCORE=1000
VITE_MAX_STREAK_DAYS=365`;

const envPath = path.join(__dirname, '.env');

try {
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Skipping creation.');
    console.log('   If you want to recreate it, delete the existing .env file first.');
    process.exit(0);
  }

  // Create .env file
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ .env file created successfully!');
  console.log('📝 Please fill in your actual API keys and configuration values.');
  console.log('🔒 Remember: Never commit .env files to version control.');
  
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}
