import { describe, expect, it } from 'vitest';
import { resolveOverlayHome } from './resolveOverlayHome';

describe('resolveOverlayHome', () => {
  it('lets the active agent-list lens win over the agent home', () => {
    expect(resolveOverlayHome({ lens: 'review', agentHome: 'workflows' })).toBe('review');
    expect(resolveOverlayHome({ lens: 'agents', agentHome: 'workflows' })).toBe('agents');
  });

  it('falls back to the agent home for lenses that host no agent list', () => {
    expect(resolveOverlayHome({ lens: 'pr', agentHome: 'workflows' })).toBe('workflows');
    expect(resolveOverlayHome({ lens: null, agentHome: 'review' })).toBe('review');
  });

  it('defaults to agents when nothing is known', () => {
    expect(resolveOverlayHome({ lens: null, agentHome: null })).toBe('agents');
  });

  it('is idempotent on an already resolved home', () => {
    const once = resolveOverlayHome({ lens: 'review', agentHome: 'workflows' });
    expect(resolveOverlayHome({ lens: 'review', agentHome: once })).toBe(once);
  });
});
