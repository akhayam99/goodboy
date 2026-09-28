import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime, ProviderId, ProviderRunId, TurnEvent } from '@goodboy/types';
import { RESTART_RESUME_PROMPT, planRestartResume } from './planRestartResume';

const AT = '2026-09-27T10:00:00.000Z' as IsoDateTime;
const RUN = 'run-cut' as ProviderRunId;

const agentOf = (overrides: Partial<Agent> = {}): Agent =>
  ({
    id: 'agent-1',
    sessionId: 'session-1',
    ordinal: 0,
    name: 'Implement',
    status: 'stopped',
    stoppedBy: 'app',
    runId: RUN,
    ...overrides,
  }) as Agent;

const ASK: TurnEvent = { kind: 'user_text', runId: RUN, text: 'add the export button', at: AT };

const planFor = ({
  provider,
  agent = agentOf({ providerSessionId: 'thread-1', providerSessionProviderId: provider }),
  transcript = [ASK],
}: {
  readonly provider: ProviderId;
  readonly agent?: Agent;
  readonly transcript?: ReadonlyArray<TurnEvent>;
}) =>
  planRestartResume({ agent, provider, isProviderConnected: true, transcript, reason: 'restart' });

describe('planRestartResume', () => {
  it.each(['anthropic', 'opencode', 'openrouter', 'moonshot'] as const)(
    'resumes %s natively from its own session',
    (provider) => {
      expect(planFor({ provider })).toEqual({
        kind: 'resume',
        mode: 'native',
        prompt: RESTART_RESUME_PROMPT,
        note: 'Resumed after Goodboy restarted.',
      });
    },
  );

  it.each(['codex', 'cursor', 'gemini'] as const)(
    'resumes %s from the prior turns it is handed',
    (provider) => {
      expect(planFor({ provider })).toMatchObject({
        kind: 'resume',
        mode: 'history',
        prompt: RESTART_RESUME_PROMPT,
      });
    },
  );

  it('sends the cut message again when claude never opened a session', () => {
    const plan = planFor({ provider: 'anthropic', agent: agentOf() });

    expect(plan).toMatchObject({ kind: 'resume', mode: 'resend', prompt: 'add the export button' });
  });

  it('does not reuse a session that belongs to another provider', () => {
    const plan = planFor({
      provider: 'anthropic',
      agent: agentOf({ providerSessionId: 'thread-1', providerSessionProviderId: 'codex' }),
    });

    expect(plan).toMatchObject({ mode: 'resend' });
  });

  it('names a tool call that was cut, so nothing runs twice without saying so', () => {
    const plan = planFor({
      provider: 'anthropic',
      transcript: [
        ASK,
        {
          kind: 'tool_call_start',
          runId: RUN,
          toolUseId: 't1',
          toolName: 'Bash',
          input: {},
          at: AT,
        },
        {
          kind: 'tool_call_start',
          runId: RUN,
          toolUseId: 't2',
          toolName: 'Edit',
          input: {},
          at: AT,
        },
        {
          kind: 'tool_call_end',
          runId: RUN,
          toolUseId: 't2',
          output: 'ok',
          isError: false,
          at: AT,
        },
      ],
    });

    expect(plan).toMatchObject({
      note: 'Resumed after Goodboy restarted. Bash had not finished when it stopped. The agent was asked to check before running it again.',
    });
  });

  it('says the update when the update restarted the app', () => {
    const plan = planRestartResume({
      agent: agentOf({ providerSessionId: 'thread-1', providerSessionProviderId: 'anthropic' }),
      provider: 'anthropic',
      isProviderConnected: true,
      transcript: [ASK],
      reason: 'update',
    });

    expect(plan).toMatchObject({ note: 'Resumed after Goodboy updated.' });
  });

  it('cannot resume on a disconnected provider or with nothing to resume', () => {
    expect(
      planRestartResume({
        agent: agentOf(),
        provider: 'codex',
        isProviderConnected: false,
        transcript: [ASK],
        reason: 'restart',
      }),
    ).toEqual({ kind: 'unresumable', reason: 'provider' });
    expect(planFor({ provider: 'codex', transcript: [] })).toEqual({
      kind: 'unresumable',
      reason: 'nothing-to-resume',
    });
  });
});
