import { describe, expect, it } from 'vitest';
import { parseOrchestratorDecision } from './parser';

const marked = (body: string): string => `<<orchestrator>>${body}<</orchestrator>>`;

describe('parseOrchestratorDecision need dispositions', () => {
  it('parses a grant carrying the next step', () => {
    const raw = marked(
      '{"action":"need","reason":"The planner cannot place the change without the caller map.","obligationId":"obl-1","disposition":{"kind":"grant","step":{"name":"Map the callers","role":"scout","promptPrefix":"List every caller.","expectedOutput":"A caller list."}}}',
    );
    expect(parseOrchestratorDecision({ raw, provider: 'anthropic' })).toEqual({
      action: 'need',
      reason: 'The planner cannot place the change without the caller map.',
      obligationId: 'obl-1',
      disposition: {
        kind: 'grant',
        step: {
          name: 'Map the callers',
          role: 'scout',
          promptPrefix: 'List every caller.',
          expectedOutput: 'A caller list.',
        },
      },
    });
  });

  it('parses evidence reuse with its sources', () => {
    const raw = marked(
      '{"action":"need","reason":"The report already answers it.","obligationId":"obl-2","disposition":{"kind":"reuse","evidenceRefs":["artifact:report-4","prior-output:agent-7"]}}',
    );
    const decision = parseOrchestratorDecision({ raw, provider: 'anthropic' });
    expect(decision).toEqual({
      action: 'need',
      reason: 'The report already answers it.',
      obligationId: 'obl-2',
      disposition: { kind: 'reuse', evidenceRefs: ['artifact:report-4', 'prior-output:agent-7'] },
    });
  });

  it('parses attach, refine and refuse', () => {
    const kinds = ['attach', 'refine', 'refuse'];
    kinds.forEach((kind) => {
      const raw = marked(
        `{"action":"need","reason":"Because.","obligationId":"obl-3","disposition":{"kind":"${kind}"}}`,
      );
      expect(parseOrchestratorDecision({ raw, provider: 'anthropic' })).toEqual({
        action: 'need',
        reason: 'Because.',
        obligationId: 'obl-3',
        disposition: { kind },
      });
    });
  });

  it('rejects a need without an obligation id, with an unknown disposition or a reuse without sources', () => {
    expect(
      parseOrchestratorDecision({
        raw: marked('{"action":"need","reason":"x","disposition":{"kind":"refuse"}}'),
        provider: 'anthropic',
      }),
    ).toBeNull();
    expect(
      parseOrchestratorDecision({
        raw: marked(
          '{"action":"need","reason":"x","obligationId":"o","disposition":{"kind":"ok"}}',
        ),
        provider: 'anthropic',
      }),
    ).toBeNull();
    expect(
      parseOrchestratorDecision({
        raw: marked(
          '{"action":"need","reason":"x","obligationId":"o","disposition":{"kind":"reuse","evidenceRefs":[]}}',
        ),
        provider: 'anthropic',
      }),
    ).toBeNull();
    expect(
      parseOrchestratorDecision({
        raw: marked(
          '{"action":"need","reason":"x","obligationId":"o","disposition":{"kind":"grant"}}',
        ),
        provider: 'anthropic',
      }),
    ).toBeNull();
  });
});
