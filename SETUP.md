# QIC Gamified Insurance App - Setup Guide

## Environment Variables Setup

### Quick Setup

1. **Create your .env file:**
   ```bash
   npm run setup
   ```
   This will create a `.env` file with all required environment variables.

2. **Fill in your API keys:**
   Edit the `.env` file and add your actual API keys and configuration values.

### Manual Setup

If you prefer to create the `.env` file manually:

1. **Copy the template:**
   ```bash
   cp env.example .env
   ```

2. **Edit the .env file:**
   Fill in your actual values for each environment variable.

## Required Environment Variables

### Essential Variables (Required for basic functionality)

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
```

### Optional Variables (For enhanced features)

```env
# AI Integration
VITE_LOVABLE_API_KEY=your_lovable_api_key_here
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Analytics & Monitoring
VITE_POSTHOG_API_KEY=your_posthog_api_key_here
VITE_SENTRY_DSN=your_sentry_dsn_here
```

## Getting API Keys

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and anon public key

### Clerk (Authentication)
1. Go to [clerk.dev](https://clerk.dev)
2. Create a new application
3. Go to API Keys
4. Copy the Publishable Key

### Lovable.dev (AI Integration)
1. Go to [lovable.dev](https://lovable.dev)
2. Sign up for an account
3. Get your API key from the dashboard

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   npm run setup
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Security Notes

- **Never commit .env files** to version control
- The `.env` file is already included in `.gitignore`
- Use different keys for development, staging, and production
- Rotate API keys regularly
- Keep your keys secure and don't share them

## Troubleshooting

### Common Issues

1. **Environment variables not loading:**
   - Make sure your `.env` file is in the root directory
   - Restart your development server after changing environment variables
   - Check that variable names start with `VITE_`

2. **API connection issues:**
   - Verify your API keys are correct
   - Check that the services are accessible from your network
   - Ensure you have the necessary permissions for the API keys

3. **Build errors:**
   - Make sure all required environment variables are set
   - Check that your API keys are valid
   - Verify that all services are properly configured

## Support

If you encounter any issues with the setup, please check:

1. The [troubleshooting section](#troubleshooting) above
2. The individual service documentation
3. The project's GitHub issues

## Next Steps

After setting up your environment variables:

1. Set up your Supabase database using the provided schema
2. Configure your authentication with Clerk
3. Set up your AI integration with Lovable.dev
4. Start developing your QIC gamified insurance app!
