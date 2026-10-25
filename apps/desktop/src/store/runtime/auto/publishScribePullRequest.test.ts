import { describe, expect, it } from 'vitest';
import type { ExtractedScribeText } from '@goodboy/core';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { ResumeScribePullRequestInput, ScribeWork } from '../../slices/scribe/types';
import { publishScribePullRequest } from './publishScribePullRequest';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-auto-scribe' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-ledger-core' });
const KEY = 'pr:mount-ledger-core';
const URL = 'https://github.com/harborline/ledger-core/pull/421';
const TEXT =
  '<<pr-title>>Add the ledger export<</pr-title>>\n<<pr-body>>Exports the ledger as CSV.<</pr-body>>';

type Ending = Readonly<{
  status: ScribeWork['status'];
  error: string | null;
  agentId: AgentId;
}>;

type HarnessParams = {
  readonly endings: ReadonlyArray<Ending>;
};

type WorkOfParams = {
  readonly ending: Ending;
  readonly output: ExtractedScribeText;
};

const workOf = ({ ending, output }: WorkOfParams): ScribeWork => ({
  key: KEY,
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  agentId: ending.agentId,
  task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
  status: ending.status,
  output,
  error: ending.error,
  pullRequest: ending.status === 'created' ? { number: 421, url: URL } : null,
  updatedAt: 1,
});

const harness = ({ endings }: HarnessParams) => {
  const calls: Array<ResumeScribePullRequestInput> = [];
  const queue = [...endings];
  let scribeWork: Readonly<Record<string, ScribeWork>> = {};
  const state = {
    get scribeWork() {
      return scribeWork;
    },
    resumeScribePullRequest: async (input: ResumeScribePullRequestInput): Promise<void> => {
      calls.push(input);
      const ending = queue.shift();
      if (ending === undefined) {
        return;
      }
      scribeWork = { [KEY]: workOf({ ending, output: input.output }) };
    },
  };
  const publish = (assistantText: string) =>
    publishScribePullRequest({
      getState: () => state,
      params: {
        sessionId: SESSION_ID,
        mountId: 'mount-ledger-core',
        agentId: AGENT_ID,
        assistantText,
      },
    });
  return { publish, calls };
};

describe('publishing the pull request an Auto Scribe wrote', () => {
  it('hands the text to the Branch page path and returns the number and link it opened', async () => {
    const built = harness({ endings: [{ status: 'created', error: null, agentId: AGENT_ID }] });

    expect(await built.publish(TEXT)).toEqual({ kind: 'opened', number: 421, url: URL });
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0]).toMatchObject({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      agentId: AGENT_ID,
      output: { prTitle: 'Add the ledger export', prBody: 'Exports the ledger as CSV.' },
    });
  });

  it('returns the reason the path stored when opening failed', async () => {
    const built = harness({
      endings: [{ status: 'failed', error: 'gh is not installed', agentId: AGENT_ID }],
    });

    expect(await built.publish(TEXT)).toEqual({ kind: 'failed', message: 'gh is not installed' });
  });

  it('never reports a request another Scribe opened as its own', async () => {
    const built = harness({
      endings: [
        {
          status: 'created',
          error: null,
          agentId: brandId<AgentId>({ value: 'agent-branch-scribe' }),
        },
      ],
    });

    expect(await built.publish(TEXT)).toEqual({
      kind: 'failed',
      message: 'The pull request was not opened.',
    });
  });

  it('fails with a reason, never silently, when the Scribe wrote no text', async () => {
    const built = harness({ endings: [] });

    expect(await built.publish('Done.')).toEqual({
      kind: 'failed',
      message: 'Scribe wrote no title or description.',
    });
    expect(built.calls).toHaveLength(0);
  });
});
