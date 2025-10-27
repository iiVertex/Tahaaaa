// LifeScoreEngine: encapsulates LifeScore/XP/Level calculations
/**
 * @typedef {Object} LevelProgress
 * @property {number} current
 * @property {number} required
 * @property {number} percentage
 */

export class LifeScoreEngine {
  constructor() {
    this.maxLifeScore = 100;
    this.xpPerLevel = 100;
  }

  /** @param {number} value */
  clampLifeScore(value) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(this.maxLifeScore, Math.round(value)));
  }

  /** @param {number} lifescore */
  percentageFromLifeScore(lifescore) {
    const clamped = this.clampLifeScore(lifescore);
    return Math.round((clamped / this.maxLifeScore) * 100);
  }

  /** @param {number} level */
  calculateXPForLevel(level) {
    return Math.max(0, Math.floor(level) * this.xpPerLevel);
  }

  /** @param {number} xp */
  calculateLevelFromXP(xp) {
    const nonNegativeXP = Math.max(0, Math.floor(xp));
    return Math.floor(nonNegativeXP / this.xpPerLevel) + 1;
  }

  /**
   * @param {number} xp
   * @param {number} level
   * @returns {LevelProgress}
   */
  calculateXPProgress(xp, level) {
    const currentLevelXP = (Math.max(1, Math.floor(level)) - 1) * this.xpPerLevel;
    const nextLevelXP = Math.max(1, Math.floor(level)) * this.xpPerLevel;
    const progressXP = Math.max(0, Math.floor(xp) - currentLevelXP);
    const requiredXP = Math.max(1, nextLevelXP - currentLevelXP);
    return {
      current: progressXP,
      required: requiredXP,
      percentage: Math.round((progressXP / requiredXP) * 100)
    };
  }

  /**
   * @param {number} lifescore
   * @returns {'excellent'|'high'|'medium'|'low'}
   */
  getLifeScoreStatus(lifescore) {
    const pct = this.percentageFromLifeScore(lifescore);
    if (pct >= 80) return 'excellent';
    if (pct >= 60) return 'high';
    if (pct >= 40) return 'medium';
    return 'low';
  }
}


