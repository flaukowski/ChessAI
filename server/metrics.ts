export type DurationStats = {
  count: number;
  totalMs: number;
  lastMs: number;
  errors: number;
};

export const metrics = {
  counters: new Map<string, number>(),
  durations: new Map<string, DurationStats>(),

  inc(name: string, value: number = 1) {
    this.counters.set(name, (this.counters.get(name) || 0) + value);
  },

  observe(name: string, ms: number, errored: boolean = false) {
    const d = this.durations.get(name) || { count: 0, totalMs: 0, lastMs: 0, errors: 0 };
    d.count += 1;
    d.totalMs += ms;
    d.lastMs = ms;
    if (errored) d.errors += 1;
    this.durations.set(name, d);
  },

  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.observe(name, Date.now() - start, false);
      return result;
    } catch (e) {
      this.observe(name, Date.now() - start, true);
      throw e;
    }
  },

  snapshot() {
    const counters: Record<string, number> = {};
    const durations: Record<string, { count: number; totalMs: number; avgMs: number; lastMs: number; errors: number }> = {};

    this.counters.forEach((v, k) => { counters[k] = v; });
    this.durations.forEach((v, k) => {
      durations[k] = {
        count: v.count,
        totalMs: v.totalMs,
        avgMs: v.count ? Math.round((v.totalMs / v.count) * 100) / 100 : 0,
        lastMs: v.lastMs,
        errors: v.errors,
      };
    });

    return { counters, durations };
  },
};
