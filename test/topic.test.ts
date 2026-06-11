import { describe, it, expect } from 'vitest';
import { topicMatches } from '@/server/subscriptions';

describe('topicMatches (Solace SMF wildcards)', () => {
  it('matches exact topics', () => {
    expect(topicMatches('a/b/c', 'a/b/c')).toBe(true);
    expect(topicMatches('a/b/c', 'a/b/d')).toBe(false);
  });

  it('* matches exactly one level', () => {
    expect(topicMatches('a/*/c', 'a/b/c')).toBe(true);
    expect(topicMatches('a/*/c', 'a/b/x/c')).toBe(false);
    expect(topicMatches('a/*', 'a/b')).toBe(true);
    expect(topicMatches('a/*', 'a/b/c')).toBe(false);
  });

  it('> matches one or more trailing levels', () => {
    expect(topicMatches('a/>', 'a/b')).toBe(true);
    expect(topicMatches('a/>', 'a/b/c/d')).toBe(true);
    expect(topicMatches('>', 'anything/at/all')).toBe(true);
    expect(topicMatches('a/>', 'b/c')).toBe(false);
  });
});
