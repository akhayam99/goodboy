import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId } from '@goodboy/types';
import { reportSourceName } from './reportSourceName';

const AGENT_ID = 'agent-7' as AgentId;
const ARTIFACT_ID = 'plan-3' as ArtifactId;

describe('reportSourceName', () => {
  it('names an agent by its display name and role', () => {
    expect(
      reportSourceName({
        source: {
          kind: 'agent',
          agent: { id: AGENT_ID, name: 'Apply the rounding fix', kind: 'implementer' },
        },
      }),
    ).toBe('Apply the rounding fix (Implementer)');
  });

  it('leaves the role out when the agent has no kind', () => {
    expect(
      reportSourceName({
        source: { kind: 'agent', agent: { id: AGENT_ID, name: 'Fix the tests' } },
      }),
    ).toBe('Fix the tests');
  });

  it('leaves the role out when the name already says it', () => {
    expect(
      reportSourceName({
        source: { kind: 'agent', agent: { id: AGENT_ID, name: 'Tester 2', kind: 'tester' } },
      }),
    ).toBe('Tester 2');
  });

  it('falls back to the agent id when the agent has no name', () => {
    expect(
      reportSourceName({
        source: { kind: 'agent', agent: { id: AGENT_ID, name: '  ', kind: 'implementer' } },
      }),
    ).toBe('agent agent-7');
  });

  it('names an artifact by its title and kind', () => {
    expect(
      reportSourceName({
        source: {
          kind: 'artifact',
          artifact: { id: ARTIFACT_ID, title: 'Round once per batch', kind: 'plan' },
        },
      }),
    ).toBe('Round once per batch (Plan)');
  });

  it('falls back to the artifact id when the artifact has no title', () => {
    expect(
      reportSourceName({
        source: { kind: 'artifact', artifact: { id: ARTIFACT_ID, title: '', kind: 'wireframe' } },
      }),
    ).toBe('wireframe plan-3');
  });
});
