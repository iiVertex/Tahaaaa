export class ScenarioService {
  // deps.repos: { analytics }
  constructor(repos = {}) {
    this.analyticsRepo = repos.analytics;
  }

  listScenarios() {
    return [
      {
        id: 'scenario-1',
        title: 'Daily Commute Safety',
        description: 'Estimate risk and impact of commute changes',
        category: 'safe_driving',
        difficulty: 'easy',
        inputs: [
          { name: 'commute_distance', label: 'Commute Distance (km)', type: 'number', placeholder: '15' },
          { name: 'driving_hours', label: 'Daily Driving Hours', type: 'number', placeholder: '1.5' },
          { name: 'seatbelt_usage', label: 'Seatbelt Usage', type: 'select', options: [
            { value: 'always', label: 'Always' },
            { value: 'often', label: 'Often' },
            { value: 'rarely', label: 'Rarely' }
          ] }
        ]
      },
      {
        id: 'scenario-2',
        title: 'Health Routine Change',
        description: 'What if you add daily walking?',
        category: 'health',
        difficulty: 'medium',
        inputs: [
          { name: 'walk_minutes', label: 'Walk Minutes/Day', type: 'number', placeholder: '30' },
          { name: 'diet_quality', label: 'Diet Quality', type: 'select', options: [
            { value: 'excellent', label: 'Excellent' },
            { value: 'good', label: 'Good' },
            { value: 'fair', label: 'Fair' },
            { value: 'poor', label: 'Poor' }
          ] }
        ]
      }
    ];
  }

  async simulate(userId, inputs = {}) {
    const { aiService } = await import('./ai.service.js');
    const prediction = await aiService.generateScenarioPrediction(userId, inputs);
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'scenario_simulated', event_data: { inputs, prediction }, created_at: new Date().toISOString() });
    return prediction;
  }
}

export const scenarioService = new ScenarioService();


