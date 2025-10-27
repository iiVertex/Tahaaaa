import { db } from '../services/supabase.js';
import { aiService } from '../services/ai.service.js';
import { GamificationService } from '../services/gamification.service.js';
import { LifeScoreEngine } from '../services/lifescore.engine.js';
import UsersRepo from '../repositories/users.repo.js';
import MissionsRepo from '../repositories/missions.repo.js';
import UserMissionsRepo from '../repositories/user-missions.repo.js';
import RewardsRepo from '../repositories/rewards.repo.js';
import AnalyticsRepo from '../repositories/analytics.repo.js';
import UserRewardsRepo from '../repositories/user-rewards.repo.js';
import LeaderboardRepo from '../repositories/leaderboard.repo.js';
import { ProfileService } from '../services/profile.service.js';
import { OnboardingService } from '../services/onboarding.service.js';
import { ScenarioService } from '../services/scenario.service.js';
import { MissionService } from '../services/mission.service.js';
import { RewardService } from '../services/reward.service.js';
import { LeaderboardService } from '../services/leaderboard.service.js';

export function buildContainer() {
  const repos = {
    users: new UsersRepo(db),
    missions: new MissionsRepo(db),
    userMissions: new UserMissionsRepo(db),
    rewards: new RewardsRepo(db),
    userRewards: new UserRewardsRepo(db),
    analytics: new AnalyticsRepo(db),
    leaderboard: new LeaderboardRepo(db)
  };

  const engine = new LifeScoreEngine();
  const gamification = new GamificationService(engine, { users: repos.users });

  // Services
  const services = {
    gamification,
    ai: aiService,
    mission: new MissionService(repos, gamification),
    reward: new RewardService(repos),
    leaderboard: new LeaderboardService(repos.leaderboard),
    profile: new ProfileService(repos, gamification),
    onboarding: new OnboardingService(repos, gamification),
    scenario: new ScenarioService(repos)
  };

  return { repos, services };
}

export const container = buildContainer();


