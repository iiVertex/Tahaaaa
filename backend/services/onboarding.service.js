import { aiService } from './ai.service.js';

export class OnboardingService {
  // deps.repos: { users }
  constructor(repos = {}, gamification) {
    this.usersRepo = repos.users;
    this.gamification = gamification;
    this.ai = aiService;
  }

  async saveOnboarding(userId, onboardingData) {
    for (let step = 1; step <= 7; step++) {
      const key = `step${step}`;
      if (onboardingData[key]) {
        await this.usersRepo.saveOnboardingResponse(userId, step, onboardingData[key]);
      }
    }
    const aiProfile = await this.ai.generateAIProfile(onboardingData);
    const existing = await this.usersRepo.getUserProfile(userId);
    const profileData = {
      ...(existing?.profile_json || {}),
      ai_profile: aiProfile
    };
    if (!existing) await this.usersRepo.createUserProfile(userId, profileData);
    else await this.usersRepo.updateUserProfile(userId, profileData);
    return { aiProfile };
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const onboardingService = undefined;


