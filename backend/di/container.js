import { db } from '../services/supabase.js';
import { aiService } from '../services/ai.service.js';
import { GamificationService } from '../services/gamification.service.js';
import { LifeScoreEngine } from '../services/lifescore.engine.js';
import UsersRepo from '../repositories/users.repo.js';
import MissionsRepo from '../repositories/missions.repo.js';
import UserMissionsRepo from '../repositories/user-missions.repo.js';
import MissionStepsRepo from '../repositories/mission-steps.repo.js';
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
import { ProductService } from '../services/product.service.js';
import { AchievementService } from '../services/achievement.service.js';
import { RetentionService } from '../services/retention.service.js';
import { MultiProductService } from '../services/multiproduct.service.js';
import { EcosystemService } from '../services/ecosystem.service.js';
import { PlayService } from '../services/play.service.js';
import PlayActivityRepo from '../repositories/play-activity.repo.js';

export function buildContainer() {
  const repos = {
    users: new UsersRepo(db),
    missions: new MissionsRepo(db),
    userMissions: new UserMissionsRepo(db),
    missionSteps: new MissionStepsRepo(db),
    rewards: new RewardsRepo(db),
    userRewards: new UserRewardsRepo(db),
    analytics: new AnalyticsRepo(db),
    leaderboard: new LeaderboardRepo(db),
    playActivity: new PlayActivityRepo(db)
  };

  const engine = new LifeScoreEngine();
  const gamification = new GamificationService(engine, { users: repos.users });

  // Services - create profile first as it's used by mission service
  const profileService = new ProfileService(repos, gamification);
  
  const services = {
    gamification,
    ai: aiService,
    profile: profileService,
    mission: new MissionService({ 
      ...repos,  // missions, userMissions, missionSteps, users, analytics
      ai: aiService, 
      profile: profileService 
    }, gamification),
    reward: new RewardService(repos),
    leaderboard: new LeaderboardService(repos.leaderboard),
    onboarding: new OnboardingService(repos, gamification),
    scenario: new ScenarioService(repos),
          product: new ProductService({ profile: profileService }),
          achievement: new AchievementService(db, gamification),
          retention: new RetentionService(db),
          multiproduct: new MultiProductService(db),
          ecosystem: new EcosystemService(db),
          play: new PlayService({ playActivity: repos.playActivity, users: repos.users, analytics: repos.analytics })
  };

  return { repos, services };
}

export const container = buildContainer();


