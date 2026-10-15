// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../shared/names';
import { AGENT_KIND_META, visibleAgentKinds } from '../session/agent-kind';

describe('the Generalist while Auto is an experiment', () => {
  it('keeps the plain name in both label sources, without a legacy mark', () => {
    expect(AGENT_KIND_META.generic.label).toBe('Generalist');
    expect(AGENT_KIND_META.generic.noun).toBe('Generalist');
    expect(NAMES.role.custom).toBe('Generalist');
    expect(JSON.stringify([AGENT_KIND_META.generic, NAMES.role.custom])).not.toMatch(/legacy/i);
  });

  it('stays the first role of the manual start and never lists Auto there', () => {
    const kinds = visibleAgentKinds();

    expect(kinds).toContain('generic');
    expect(kinds).not.toContain('auto');
  });
});
