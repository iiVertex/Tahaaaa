$ErrorActionPreference = 'Stop'

$base = 'http://localhost:3001'
$sid = [guid]::NewGuid().ToString('N')
$h = @{ 'x-session-id' = $sid; 'Content-Type' = 'application/json' }

Write-Host "Using session: $sid"

$health = Invoke-RestMethod -Method GET -Uri "$base/api/health"

$missionsResp = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/missions"
$missionId = $missionsResp.data.missions[0].id
$start = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/missions/start" -Body (@{ missionId = $missionId } | ConvertTo-Json)
$complete = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/missions/complete" -Body (@{ missionId = $missionId } | ConvertTo-Json)

$rewardsResp = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/rewards"
$rewardId = $rewardsResp.data.rewards[0].id
$redeem = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/rewards/redeem" -Body (@{ rewardId = $rewardId } | ConvertTo-Json)

$skillTree = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/skill-tree"
$skillId = $skillTree.data.skills[0].id
$unlock = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/skill-tree/unlock" -Body (@{ skillId = $skillId } | ConvertTo-Json)

$scenario = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/scenarios/simulate" -Body (@{ lifestyle_factors = @{ age = 30 } } | ConvertTo-Json)

$friends = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/social/friends"
$leaderboard = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/social/leaderboard"

$profile = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/profile"
$update = Invoke-RestMethod -Headers $h -Method PUT -Uri "$base/api/profile" -Body (@{ nickname = 'hero' } | ConvertTo-Json)

$result = [PSCustomObject]@{
  sessionId = $sid
  health = $health.data.status
  missionId = $missionId
  missionStart = $start.success
  missionComplete = $complete.success
  rewardId = $rewardId
  rewardRedeem = $redeem.success
  skillId = $skillId
  skillUnlock = $unlock.success
  scenarioSimulate = $scenario.success
  friendsCount = ($friends.data.friends | Measure-Object).Count
  leaderboardCount = ($leaderboard.data.leaderboard | Measure-Object).Count
  profileGet = $profile.success
  profileUpdate = $update.success
}

$result | ConvertTo-Json -Depth 5


