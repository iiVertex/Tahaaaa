$ErrorActionPreference = 'Stop'

$base = 'http://localhost:3001'
$sid = [guid]::NewGuid().ToString('N')
$h = @{ 'x-session-id' = $sid; 'Content-Type' = 'application/json' }
$EnableRateLimitTest = $false

Write-Host "Using session: $sid"

# Phase 0 — Environment & Security
$health = Invoke-RestMethod -Method GET -Uri "$base/api/health"
try {
  $preflight = Invoke-WebRequest -UseBasicParsing -Method OPTIONS -Uri "$base/api/missions" -Headers @{ 'Origin'='http://localhost:8082'; 'Access-Control-Request-Method'='GET' }
} catch { $preflight = $_.Exception.Response }

# Helper: run and time a request
function Invoke-WithTiming {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [hashtable]$Headers,
    [string]$Body
  )
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    if ($null -ne $Body) { $res = Invoke-RestMethod -Headers $Headers -Method $Method -Uri $Url -Body $Body }
    else { $res = Invoke-RestMethod -Headers $Headers -Method $Method -Uri $Url }
    $sw.Stop()
    return [PSCustomObject]@{ ok=$true; ms=$sw.ElapsedMilliseconds; data=$res }
  } catch {
    $sw.Stop()
    $code = $null
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    return [PSCustomObject]@{ ok=$false; ms=$sw.ElapsedMilliseconds; status=$code; error=$_.Exception.Message }
  }
}

# Phase 1 — Missions Flow
$missionsResp = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/missions"
$missionId = $missionsResp.data.missions[0].id
$start = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/missions/start" -Body (@{ missionId = $missionId } | ConvertTo-Json)
$complete = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/missions/complete" -Body (@{ missionId = $missionId } | ConvertTo-Json)
$missionStartOk = ($start.ok -or ($start.status -eq 409))

# Phase 2 — Rewards Hub
$rewardsResp = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/rewards"
$rewardId = $rewardsResp.data.rewards[0].id
$profileCoinsResp = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/profile"
$coins = 0
try { $coins = ($profileCoinsResp.data.data.user.coins); if ($null -eq $coins) { $coins = ($profileCoinsResp.data.data.stats.coins) } } catch { $coins = 0 }
$affordable = $rewardsResp.data.rewards | Where-Object { $_.coins_cost -le $coins } | Select-Object -First 1
$redeemPossible = ($null -ne $affordable)
if ($null -ne $affordable) {
  $rewardId = $affordable.id
  $redeem = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/rewards/redeem" -Body (@{ rewardId = $rewardId } | ConvertTo-Json)
} else {
  $redeem = [PSCustomObject]@{ ok=$false; ms=0 }
}

# Phase 3 — AI Recommendations
$ai = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/ai/recommendations"

# Phase 4 — Scenarios
$scenarioPayload = @{ walk_minutes = 30; diet_quality = 'good' } | ConvertTo-Json
$scenario = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/scenarios/simulate" -Body $scenarioPayload
$scenarioApply = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/scenarios/simulate?apply=true" -Body $scenarioPayload

# Phase 5 — Social
$friends = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/social/friends"
$leaderboard = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/social/leaderboard"

# Phase 6 — Profile
$profile = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/profile"
$update = Invoke-WithTiming -Headers $h -Method PUT -Url "$base/api/profile" -Body (@{ username = 'hero' } | ConvertTo-Json)
$profileDirectOk = $false
try { $tmp = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/profile"; $profileDirectOk = $true } catch {}

# Phase 7 — Onboarding (DI path)
$onboardingPayload = @{ 
  step1 = @{ driving_habits='moderate'; health_status='good'; risk_tolerance='medium' };
  step2 = @{ daily_routine='moderate'; exercise_frequency=3; diet_quality='good' };
  step3 = @{ dependents=1; family_health='good'; family_size=3 };
  step4 = @{ savings_goal=5000; investment_risk='moderate'; insurance_priority=@('health') };
  step5 = @{ coverage_types=@('health'); premium_budget=100; deductible_preference='medium' };
  step6 = @{ integrations = @('QIC Mobile App','QIC Health Portal','QIC Rewards Program') };
  step7 = @{}
} | ConvertTo-Json -Depth 5
$onboardingSubmit = Invoke-WithTiming -Headers $h -Method POST -Url "$base/api/onboarding/submit" -Body $onboardingPayload
$onboardingProgress = Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/onboarding/progress"

# Phase 8 — Negative paths
# 401 without session
try { $unauthMissions = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$base/api/missions" } catch { $unauthMissions = $_.Exception.Response }
# 400 bad body
$badStart = $null; try { $badStart = Invoke-WebRequest -UseBasicParsing -Headers $h -Method POST -Uri "$base/api/missions/start" -Body (@{} | ConvertTo-Json) } catch { $badStart = $_.Exception.Response }
if ($EnableRateLimitTest) {
  # 429 rate limit (hit POST simulate repeatedly)
  $rateStatus = $null
  for ($i=0; $i -lt 12; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -Headers $h -Method POST -Uri "$base/api/scenarios/simulate" -Body $scenarioPayload | Out-Null }
    catch {
      try { $rateStatus = $_.Exception.Response.StatusCode.value__ } catch { $rateStatus = $null }
      if ($rateStatus -eq 429) { break }
    }
  }
} else { $rateStatus = 0 }

# Phase 9 — Performance smoke (simple 3x timings)
function AvgMs {
  param([int[]]$arr)
  if ($arr.Count -eq 0) { return 0 }
  return [int]($arr | Measure-Object -Average | Select-Object -ExpandProperty Average)
}
$tM = @(); $tR = @();
for ($i=0; $i -lt 3; $i++) {
  $tM += (Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/missions").ms
  $tR += (Invoke-WithTiming -Headers $h -Method GET -Url "$base/api/rewards").ms
}
$avgMissionsMs = AvgMs $tM
$avgRewardsMs = AvgMs $tR

$aiData = $null
if ($ai.data -and $ai.data.data) { $aiData = $ai.data.data } else { $aiData = $ai.data }
$scenarioApplyData = $null
if ($scenarioApply.data -and $scenarioApply.data.data) { $scenarioApplyData = $scenarioApply.data.data } else { $scenarioApplyData = $scenarioApply.data }
$friendsData = $null
if ($friends.data -and $friends.data.data) { $friendsData = $friends.data.data } else { $friendsData = $friends.data }
$leaderboardData = $null
if ($leaderboard.data -and $leaderboard.data.data) { $leaderboardData = $leaderboard.data.data } else { $leaderboardData = $leaderboard.data }

$aiInsightsCount = @($aiData.insights).Count
$aiMissionsCount = @($aiData.suggested_missions).Count
$scenarioApplyStartedCount = 0
try { $scenarioApplyStartedCount = @($scenarioApplyData.applied.started).Count } catch { $scenarioApplyStartedCount = 0 }
$friendsCountVal = @($friendsData.friends).Count
$leaderboardCountVal = @($leaderboardData.leaderboard).Count

$result = [PSCustomObject]@{
  sessionId = $sid
  health = $health.data.status
  corsPreflightOk = ($preflight.StatusCode -eq 204 -or $preflight.StatusCode -eq 200)
  missionId = $missionId
  missionStart = $start.ok
  missionStartIdempotent = $missionStartOk
  missionStartMs = $start.ms
  missionComplete = $complete.ok
  missionCompleteMs = $complete.ms
  rewardId = $rewardId
  rewardRedeem = $redeem.ok
  rewardRedeemMs = $redeem.ms
  rewardRedeemPossible = $redeemPossible
  aiInsights = $aiInsightsCount
  aiMissions = $aiMissionsCount
  scenarioSimulate = $scenario.ok
  scenarioApplyStarted = $scenarioApplyStartedCount
  friendsCount = $friendsCountVal
  leaderboardCount = $leaderboardCountVal
  profileGet = ($profile.ok -or $profileDirectOk)
  profileUpdate = $update.ok
  onboardingSubmit = $onboardingSubmit.ok
  onboardingProgress = $onboardingProgress.ok
  negative401 = ($unauthMissions.StatusCode.value__ -eq 401)
  negative400 = ($badStart.StatusCode.value__ -eq 400)
  negative429 = ($rateStatus -eq 429)
  avgMissionsMs = $avgMissionsMs
  avgRewardsMs = $avgRewardsMs
}

$result | ConvertTo-Json -Depth 5


