// Placeholder repository; would insert user_behavior_events and query analytics views
export class AnalyticsRepo {
  constructor(database) {
    this.db = database;
    this.memory = { eventsByUserId: new Map() };
  }

  async insertBehaviorEvent(event) {
    if (typeof this.db?.query === 'function') {
      try {
        await this.db.query('user_behavior_events', { type: 'insert' }, { data: event });
      } catch (_) {}
    } else {
      const list = this.memory.eventsByUserId.get(event.user_id) || [];
      list.unshift(event);
      this.memory.eventsByUserId.set(event.user_id, list);
    }
  }

  async getEngagementSummary(userId) {
    // DB path: try materialized view, fallback to direct aggregation
    if (typeof this.db?.query === 'function') {
      try {
        try {
          const rows = await this.db.query('user_engagement_summary', { type: 'select' }, { filters: { user_id: userId } });
          const row = Array.isArray(rows) ? rows[0] : rows;
          if (row) {
            return {
              user_id: userId,
              active_days: row.active_days ?? 0,
              total_events: row.total_events ?? 0,
              last_activity: row.last_activity ?? null,
              unique_event_types: row.unique_event_types ?? 0
            };
          }
        } catch (_) {}
        // Fallback: aggregate from user_behavior_events
        const events = await this.db.query('user_behavior_events', { type: 'select' }, {
          filters: { user_id: userId },
          orderBy: { column: 'created_at', ascending: false }
        });
        const list = Array.isArray(events) ? events : [];
        return this.aggregateSummary(list, userId);
      } catch (_) {
        // Continue to in-memory fallback
      }
    }
    // In-memory fallback
    const list = this.memory.eventsByUserId.get(userId) || [];
    return this.aggregateSummary(list, userId);
  }

  aggregateSummary(events, userId) {
    const dates = new Set();
    let last = null;
    const types = new Set();
    for (const e of events) {
      const d = new Date(e.created_at || Date.now());
      dates.add(d.toISOString().slice(0, 10));
      types.add(e.event_type || 'unknown');
      if (!last || d > new Date(last)) last = d.toISOString();
    }
    return {
      user_id: userId,
      active_days: dates.size,
      total_events: events.length,
      last_activity: last,
      unique_event_types: types.size
    };
  }

  async getBehaviorSummary(userId) {
    // Placeholder aggregation shape used by AI insights
    return {
      user_id: userId,
      last7_days_events: 0,
      mission_completions: 0,
      streak_days: 0,
      lifescore_trend: 'flat'
    };
  }

  async getRecentEvents(userId, limit = 20) {
    if (typeof this.db?.query === 'function') {
      try {
        const events = await this.db.query('user_behavior_events', { type: 'select' }, {
          filters: { user_id: userId },
          orderBy: { column: 'created_at', ascending: false },
          limit
        });
        return Array.isArray(events) ? events : [];
      } catch (_) {}
    }
    const list = this.memory.eventsByUserId.get(userId) || [];
    return list.slice(0, limit);
  }
}

export default AnalyticsRepo;


