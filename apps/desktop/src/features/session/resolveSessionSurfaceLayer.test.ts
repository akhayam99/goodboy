// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { resolveSessionSurfaceLayer } from './resolveSessionSurfaceLayer';

const AGENT = 'agent-report-1' as AgentId;
const OTHER = 'agent-implementer-2' as AgentId;

describe('resolveSessionSurfaceLayer', () => {
  it('overlays the lens when an agent is selected from anywhere else', () => {
    expect(
      resolveSessionSurfaceLayer({
        lens: 'agents',
        selectedAgentId: AGENT,
        artifactConversationAgentId: null,
      }),
    ).toBe('agent');
  });

  it('keeps the artifact workspace when it hosts the conversation of the selected agent', () => {
    expect(
      resolveSessionSurfaceLayer({
        lens: 'plans',
        selectedAgentId: AGENT,
        artifactConversationAgentId: AGENT,
      }),
    ).toBe('lens');
  });

  it('overlays again once another agent is selected while the artifact detail was open', () => {
    expect(
      resolveSessionSurfaceLayer({
        lens: 'plans',
        selectedAgentId: OTHER,
        artifactConversationAgentId: AGENT,
      }),
    ).toBe('agent');
  });

  it('does not let a stale artifact host suppress the overlay from another lens', () => {
    expect(
      resolveSessionSurfaceLayer({
        lens: 'agents',
        selectedAgentId: AGENT,
        artifactConversationAgentId: AGENT,
      }),
    ).toBe('agent');
  });

  it('shows the lens when nothing is selected', () => {
    expect(
      resolveSessionSurfaceLayer({
        lens: 'plans',
        selectedAgentId: null,
        artifactConversationAgentId: null,
      }),
    ).toBe('lens');
  });
});
