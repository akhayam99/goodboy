import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_LEAD_FRESH_GAP_MS,
  LEAD_DELIVERY_HEADER,
  type LeadDeliveryPart,
} from '@goodboy/core/auto';
import type { HandoffBodyLayers } from '@goodboy/core/handoff';
import { brandId, type AgentId } from '@goodboy/types';
import { leadDeliveryMemory } from './leadDeliveryMemory';
import { planLeadTurn, type PlanLeadTurnParams } from './planLeadTurn';

const LEAD = brandId<AgentId>({ value: 'agent-lead-harborline' });
const SESSION = 'claude-session-harborline';
const NOW = 100 * AUTO_LEAD_FRESH_GAP_MS;
const MARKERS = '## context handoff protocol (markers)';

type DeliveryParams = {
  readonly ledger: string;
  readonly user: string;
};

const deliveryOf = ({ ledger, user }: DeliveryParams): ReadonlyArray<LeadDeliveryPart> => [
  { name: 'ledger', kind: 'list', text: ledger },
  { name: 'budget', kind: 'state', text: 'Budget for this conversation: 5.00 USD.' },
  { name: 'user', kind: 'news', text: user },
];

const LEDGER_V1 = 'Artifacts in this tree.\n- art-plan (plan) "ledger-core export" v1';
const LEDGER_V2 = 'Artifacts in this tree.\n- art-plan (plan) "ledger-core export" v2';

type TurnParams = {
  readonly runId: string;
  readonly delivery: ReadonlyArray<LeadDeliveryPart>;
  readonly resumeSessionId?: string | null;
  readonly lastTurn?: PlanLeadTurnParams['lastTurn'];
  readonly model?: string;
};

const turn = ({
  runId,
  delivery,
  resumeSessionId = SESSION,
  lastTurn = { endedAtMs: NOW - 60_000, model: 'sonnet' },
  model = 'sonnet',
}: TurnParams) => {
  const content = delivery
    .map((part) => part.text)
    .filter((text) => text !== '')
    .join('\n\n');
  const layers: HandoffBodyLayers = {
    message: content,
    contextPreamble: MARKERS,
    childRouting: 'MODELS: sonnet, opus',
    clusterBoundary: null,
    currentPlan: '',
    goalAttachments: '',
    priorTurns: '',
    verbosity: 'Reply briefly.',
  };
  return planLeadTurn({
    agentId: LEAD,
    runId,
    resumeSessionId,
    lastTurn,
    model,
    nowMs: NOW,
    delivery,
    content,
    layers,
    preamble: [{ name: 'markers', kind: 'state', text: MARKERS }],
    candidates: 'CANDIDATES: scout on sonnet',
  });
};

const ack = ({ runId }: { readonly runId: string }) =>
  leadDeliveryMemory.ack({ agentId: LEAD, runId, sessionId: SESSION });

beforeEach(() => {
  leadDeliveryMemory.clear();
});

describe('a Lead delivery', () => {
  it('carries everything on the first turn of a session', () => {
    const first = turn({
      runId: 'run-1',
      delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start the export' }),
      resumeSessionId: null,
      lastTurn: null,
    });

    expect(first.mode).toBe('full');
    expect(first.prompt).toContain(MARKERS);
    expect(first.prompt).toContain('CANDIDATES: scout on sonnet');
    expect(first.prompt).toContain('start the export');
  });

  it('carries only the new message once the session acknowledged the last delivery', () => {
    turn({ runId: 'run-1', delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start' }) });
    ack({ runId: 'run-1' });

    const second = turn({
      runId: 'run-2',
      delivery: deliveryOf({ ledger: LEDGER_V1, user: 'add tests' }),
    });

    expect(second.mode).toBe('delta');
    expect(second.prompt.startsWith(LEAD_DELIVERY_HEADER.delta)).toBe(true);
    expect(second.prompt).toContain('add tests');
    expect(second.prompt).not.toContain(MARKERS);
    expect(second.prompt).not.toContain('Artifacts in this tree');
  });

  it('sends again what a failed turn carried', () => {
    turn({ runId: 'run-1', delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start' }) });
    ack({ runId: 'run-1' });
    turn({ runId: 'run-2', delivery: deliveryOf({ ledger: LEDGER_V2, user: 'review it' }) });
    leadDeliveryMemory.drop({ agentId: LEAD, runId: 'run-2' });

    const retried = turn({
      runId: 'run-3',
      delivery: deliveryOf({ ledger: LEDGER_V2, user: 'review it' }),
    });

    expect(retried.mode).toBe('delta');
    expect(retried.prompt).toContain('"ledger-core export" v2');
    expect(retried.prompt).toContain('review it');
  });

  it('ignores a late acknowledgment of an older turn', () => {
    turn({ runId: 'run-1', delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start' }) });
    turn({ runId: 'run-2', delivery: deliveryOf({ ledger: LEDGER_V2, user: 'again' }) });

    expect(ack({ runId: 'run-1' })).toBeNull();
    expect(leadDeliveryMemory.baselineOf({ agentId: LEAD })).toBeNull();
    expect(
      turn({ runId: 'run-3', delivery: deliveryOf({ ledger: LEDGER_V2, user: 'more' }) }).mode,
    ).toBe('full');
  });

  it('starts a new session with the whole state after a long gap or a model change', () => {
    turn({ runId: 'run-1', delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start' }) });
    ack({ runId: 'run-1' });

    const cold = turn({
      runId: 'run-2',
      delivery: deliveryOf({ ledger: LEDGER_V1, user: 'back after lunch' }),
      lastTurn: { endedAtMs: NOW - AUTO_LEAD_FRESH_GAP_MS - 1, model: 'sonnet' },
    });
    const moved = turn({
      runId: 'run-3',
      delivery: deliveryOf({ ledger: LEDGER_V1, user: 'go on' }),
      model: 'opus',
    });

    expect(cold.mode).toBe('fresh');
    expect(cold.prompt.startsWith(LEAD_DELIVERY_HEADER.fresh)).toBe(true);
    expect(cold.prompt).toContain(MARKERS);
    expect(cold.prompt).toContain('Artifacts in this tree');
    expect(moved.mode).toBe('fresh');
  });

  it('keeps no baseline for a new session that never said its id', () => {
    turn({
      runId: 'run-1',
      delivery: deliveryOf({ ledger: LEDGER_V1, user: 'start' }),
      model: 'opus',
    });

    ack({ runId: 'run-1' });

    expect(leadDeliveryMemory.baselineOf({ agentId: LEAD })).toBeNull();
  });
});
