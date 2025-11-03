# AI API Temporary Disable Instructions

## Quick Disable (Credits Exceeded)

If your OpenAI credits have been exceeded, you can temporarily disable the AI API to prevent errors:

### Option 1: Set Environment Variable

In your `backend/.env` file, add or update:

```bash
DISABLE_AI_API=true
```

Or:

```bash
DISABLE_OPENAI=true
```

### Option 2: Quick Terminal Command

**Windows PowerShell:**
```powershell
cd backend
Add-Content .env "`nDISABLE_AI_API=true"
```

**Linux/Mac:**
```bash
cd backend
echo "DISABLE_AI_API=true" >> .env
```

### Re-enable AI API

When credits are restored, simply change in `.env`:

```bash
DISABLE_AI_API=false
```

Or remove the line entirely.

### What Happens When Disabled?

- All AI API calls will return graceful errors
- Users will see: "AI service temporarily unavailable"
- Coins will NOT be deducted when AI is disabled
- The app will continue to work for non-AI features
- Error logs will show: "AI API disabled via DISABLE_AI_API flag"

### Automatic Detection

The system also automatically detects credit/quota errors from OpenAI:
- `insufficient_quota`
- `rate_limit_exceeded`
- `429` (rate limit)
- `401` (invalid API key)

When detected, it will log a warning and suggest setting `DISABLE_AI_API=true`.

### Monitor Terminal Logs

Watch your backend terminal for messages like:
- "OpenAI credit/quota exceeded"
- "AI API temporarily disabled via DISABLE_AI_API flag"
- "OpenAI prompt error" (with error details)

