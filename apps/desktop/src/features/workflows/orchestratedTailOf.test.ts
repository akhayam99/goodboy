// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime } from '@goodboy/types';
import type { OrchestratorPhase, OrchestratorState } from './orchestratorState';
import { orchestratedTailOf, type OrchestratedTail } from './orchestratedTailOf';
import type { RunPrimary } from './runPrimaryOf';

const STARTED: IsoDateTime = JSON.parse('"2026-10-16T15:09:30.000Z"');

type AgentParams = {
  readonly key: string;
  readonly ordinal: number;
  readonly status: Agent['status'];
  readonly parent?: string;
};

const agentOf = ({ key, ordinal, status, parent }: AgentParams): Agent => ({
  id: JSON.parse(`"mock-tail-${key}"`),
  sessionId: JSON.parse('"mock-tail-session"'),
  workflowRunId: JSON.parse('"mock-tail-run"'),
  ordinal,
  name: key,
  kind: 'tester',
  status,
  startedAt: STARTED,
  ...(parent === undefined ? {} : { parentAgentId: JSON.parse(`"mock-tail-${parent}"`) }),
});

type StateParams = {
  readonly phase: OrchestratorPhase;
  readonly sentence: string;
  readonly detail?: string | null;
  readonly waitingOnAgentId?: AgentId | null;
};

const stateOf = ({
  phase,
  sentence,
  detail = null,
  waitingOnAgentId = null,
}: StateParams): OrchestratorState => ({
  phase,
  tone: 'neutral',
  sentence,
  detail,
  waitingOnAgentId,
});

const DONE = agentOf({ key: 'scout', ordinal: 0, status: 'completed' });
const RUNNING = agentOf({ key: 'tester', ordinal: 1, status: 'running' });
const CHILD = agentOf({ key: 'bench', ordinal: 2, status: 'running', parent: 'tester' });

const DECIDE: RunPrimary = { kind: 'decide-next', label: 'Decide next step' };
const RETRY: RunPrimary = { kind: 'retry', label: 'Retry' };

type TailParams = {
  readonly orchestrator: OrchestratorState;
  readonly agents?: ReadonlyArray<Agent>;
  readonly primary?: RunPrimary | null;
  readonly queuedCount?: number;
};

type DrawnParams = {
  readonly tail: OrchestratedTail | null;
};

const drawn = ({ tail }: DrawnParams): OrchestratedTail => {
  if (tail === null) {
    throw new Error('expected a tail');
  }
  return tail;
};

const tailOf = ({ orchestrator, agents = [DONE], primary = null, queuedCount = 0 }: TailParams) =>
  drawn({
    tail: orchestratedTailOf({
      orchestrator,
      agents,
      primary,
      queuedCount,
      isDiscarded: false,
      quiet: null,
      restartStoppedCount: 0,
    }),
  });

describe('orchestratedTailOf', () => {
  it('says a paused run is paused and leaves Resume run to the header', () => {
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'paused', sentence: 'Paused by you' }),
      primary: { kind: 'resume', label: 'Resume' },
    });
    expect(tail?.phrase).toBe('Paused by you');
    expect(tail?.verbs).toEqual([]);
  });

  it('reads the running step as working, with Stop step N and its clock', () => {
    const tail = tailOf({
      orchestrator: stateOf({
        phase: 'waiting',
        sentence: 'Step 2 is running: tester',
        waitingOnAgentId: RUNNING.id,
      }),
      agents: [DONE, RUNNING, CHILD],
    });
    expect(tail.state).toBe('working');
    expect(tail.stepAgentId).toBe(RUNNING.id);
    expect(tail?.verbs).toEqual([{ kind: 'stopStep', agent: RUNNING, number: 2 }]);
  });

  it('continues a step that was stopped', () => {
    const stopped: Agent = { ...RUNNING, status: 'stopped' };
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'waiting', sentence: 'Step 2 stopped by you · tester' }),
      agents: [DONE, stopped],
    });
    expect(tail.state).toBe('stopped');
    expect(tail?.verbs).toEqual([{ kind: 'continueStep', agentId: stopped.id }]);
  });

  it('is working with no verb while the orchestrator decides', () => {
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'deciding', sentence: 'Choosing the next step' }),
    });
    expect(tail).toMatchObject({ state: 'working', phrase: 'Choosing the next step', verbs: [] });
  });

  it('waits for your go with Decide next step', () => {
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'ready-mid', sentence: 'Waiting for your go' }),
      primary: DECIDE,
    });
    expect(tail.state).toBe('idle');
    expect(tail?.verbs).toEqual([{ kind: 'primary', primary: DECIDE }]);
  });

  it('says why the last decision failed and offers Retry and View transcript', () => {
    const tail = tailOf({
      orchestrator: stateOf({
        phase: 'failed',
        sentence: 'Last decision failed',
        detail: 'the orchestrator returned no step.',
      }),
      primary: RETRY,
    });
    expect(tail.state).toBe('failed');
    expect(tail?.phrase).toBe('Last decision failed: the orchestrator returned no step.');
    expect(tail?.verbs).toEqual([
      { kind: 'primary', primary: RETRY },
      { kind: 'viewTranscript', agentId: DONE.id },
    ]);
  });

  it('restarts a failed step', () => {
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'step-failed', sentence: 'Paused on failed step 1' }),
    });
    expect(tail?.verbs).toEqual([{ kind: 'restartStep' }]);
  });

  it('reads the queued hints on a finished run, and resumes with them after Stop step', () => {
    const done = tailOf({
      orchestrator: stateOf({ phase: 'done', sentence: 'Run complete · 1 step · $0.10' }),
      queuedCount: 2,
    });
    expect(done.verbs).toEqual([{ kind: 'readQueued', count: 2, isStopped: false }]);
    const stopped = tailOf({
      orchestrator: stateOf({ phase: 'stopped', sentence: 'Stopped by you' }),
      primary: { kind: 'continue', label: 'Continue the run' },
      queuedCount: 1,
    });
    expect(stopped.verbs).toEqual([{ kind: 'readQueued', count: 1, isStopped: true }]);
  });

  it('settles a finished run with no verb when nothing is queued', () => {
    const tail = tailOf({
      orchestrator: stateOf({ phase: 'done', sentence: 'Run complete · 1 step · $0.10' }),
    });
    expect(tail).toMatchObject({ state: 'idle', verbs: [] });
  });

  it('asks a quiet step to continue before anything else', () => {
    const tail = orchestratedTailOf({
      orchestrator: stateOf({ phase: 'waiting', sentence: 'Step 2 is running: tester' }),
      agents: [DONE, RUNNING],
      primary: null,
      queuedCount: 0,
      isDiscarded: false,
      quiet: { agentId: RUNNING.id, minutes: 6 },
      restartStoppedCount: 0,
    });
    expect(tail?.phrase).toBe('No output for 6 min');
    expect(tail?.verbs).toEqual([{ kind: 'quiet', agentId: RUNNING.id }]);
  });

  it('resumes the agents a restart stopped', () => {
    const tail = orchestratedTailOf({
      orchestrator: stateOf({ phase: 'waiting', sentence: 'Step 2 stopped by restart · tester' }),
      agents: [DONE, RUNNING],
      primary: null,
      queuedCount: 0,
      isDiscarded: false,
      quiet: null,
      restartStoppedCount: 2,
    });
    expect(tail?.phrase).toBe('2 agents stopped when Goodboy closed');
    expect(tail?.verbs).toEqual([{ kind: 'resumeAll', count: 2 }]);
  });

  it('names the model in a failed decision, never its raw id', () => {
    const tail = orchestratedTailOf({
      orchestrator: stateOf({
        phase: 'failed',
        sentence: 'Last decision failed',
        detail: 'usage limit reached (anthropic/haiku-4.5)',
      }),
      agents: [DONE],
      primary: null,
      queuedCount: 0,
      isDiscarded: false,
      quiet: null,
      restartStoppedCount: 0,
    });
    expect(tail?.phrase).not.toContain('anthropic/');
    expect(tail?.phrase.startsWith('Last decision failed: usage limit reached (')).toBe(true);
  });

  it('draws no tail on an archived run', () => {
    const tail = orchestratedTailOf({
      orchestrator: stateOf({ phase: 'waiting', sentence: 'Waiting' }),
      agents: [DONE],
      primary: null,
      queuedCount: 3,
      isDiscarded: true,
      quiet: null,
      restartStoppedCount: 0,
    });
    expect(tail).toBeNull();
  });
});
