import { describe, it, expect } from 'vitest';
import { getLimitsFor, PLAN_LIMITS } from '../../src/utils/planLimits.js';

describe('planLimits', () => {
  it('FREE limita a 3 productos y bloquea 30 días', () => {
    const limits = getLimitsFor('FREE');
    expect(limits.maxTrackedProducts).toBe(3);
    expect(limits.productLockDays).toBe(30);
    expect(limits.sources).toEqual(['ML']);
    expect(limits.canSeeTrending).toBe(false);
    expect(limits.hasAds).toBe(true);
  });

  it('PRO permite 50 productos sin bloqueo', () => {
    const limits = getLimitsFor('PRO');
    expect(limits.maxTrackedProducts).toBe(50);
    expect(limits.productLockDays).toBe(0);
    expect(limits.sources).toContain('ML');
    expect(limits.sources).toContain('ALIEXPRESS');
    expect(limits.canSeeTrending).toBe(true);
  });

  it('COMERCIANTE es ilimitado y ve LATAM completo', () => {
    const limits = getLimitsFor('COMERCIANTE');
    expect(limits.maxTrackedProducts).toBe(Number.POSITIVE_INFINITY);
    expect(limits.trendingAllLatam).toBe(true);
    expect(limits.canSeeMargins).toBe(true);
  });

  it('PLAN_LIMITS contiene los 3 planes', () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(['FREE', 'PRO', 'COMERCIANTE']);
  });
});
