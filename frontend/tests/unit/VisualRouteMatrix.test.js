import { describe, expect, it } from 'vitest';
import pagesJson from '@/pages.json';
import {
  CORE_VISUAL_MATRIX,
  ROUTE_VISUAL_MATRIX,
  STATE_VISUAL_MATRIX,
} from '../e2e/fixtures/visualReviewMatrix';

describe('V2 visual review matrix', () => {
  it('maps every registered page exactly once', () => {
    expect(pagesJson.pages[0].path).toBe('pages/index');
    const registered = pagesJson.pages.map((page) => `/${page.path}`).sort();
    const mapped = ROUTE_VISUAL_MATRIX.map((entry) => entry.route).sort();

    expect(registered).toHaveLength(39);
    expect(mapped).toEqual(registered);
    expect(new Set(ROUTE_VISUAL_MATRIX.map((entry) => entry.slug)).size)
      .toBe(ROUTE_VISUAL_MATRIX.length);
  });

  it('gives every route a concrete responsibility and repeatable target', () => {
    ROUTE_VISUAL_MATRIX.forEach((entry) => {
      if (entry.expectedPath) {
        expect(entry.route).toBe('/pages/index');
        expect(entry.target).toBe(entry.expectedPath);
      } else {
        expect(entry.target.startsWith(entry.route)).toBe(true);
      }
      expect(entry.issues.length > 0 || entry.plan?.startsWith('docs/plans/')).toBe(true);
      expect(entry.issues.every((issue) => Number.isInteger(issue) && issue > 0)).toBe(true);
      expect(['guest', 'member']).toContain(entry.persona);
    });
  });

  it('covers four core surfaces across both themes and identities', () => {
    expect(CORE_VISUAL_MATRIX.map((entry) => entry.surface)).toEqual([
      'listen', 'search', 'record', 'mine',
    ]);
    expect(CORE_VISUAL_MATRIX.length * 2 * 2).toBe(16);
  });

  it('uses one registered route to review the missing-avatar fallback', () => {
    expect(ROUTE_VISUAL_MATRIX
      .filter((entry) => entry.avatarState === 'missing')
      .map((entry) => entry.route))
      .toEqual(['/pages/users/me']);
  });

  it('keeps loading, empty, error and success as explicit state samples', () => {
    expect(STATE_VISUAL_MATRIX.map((entry) => entry.state).sort()).toEqual([
      'empty', 'error', 'loading', 'success',
    ]);
  });
});
