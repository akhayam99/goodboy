import {
  pullRequestAskTextOf,
  pullRequestTextVersionOf,
  type ResultPublish,
  type ResultPullRequest,
} from '@goodboy/core/auto';
import { extractScribeText } from '@goodboy/core/context';
import type { AutoAttempt, AutoDelegation, AutoTree } from '@goodboy/db';
import { readPublishPermissions } from '../level/readPublishPermissions';
import type { AgentVerbContext } from '../verbContext';
import { holdScribePullRequest } from './holdScribePullRequest';
import { pullRequestPushGateOf } from './pullRequestPushGateOf';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly mountId: string;
  readonly assistantText: string;
};

export type ScribePublicationOutcome =
  | Readonly<{ kind: 'failed'; message: string }>
  | Readonly<{
      kind: 'done';
      line: string;
      pullRequest: ResultPullRequest | null;
      raisedPush: ResultPublish | null;
    }>;

export const scribePublicationOf = async ({
  ctx,
  tree,
  delegation,
  attempt,
  mountId,
  assistantText,
}: Params): Promise<ScribePublicationOutcome> => {
  const output = extractScribeText(assistantText);
  const hasText = output.prTitle !== null || output.prBody !== null;
  const { pullRequest } = await readPublishPermissions({ db: ctx.db, treeId: tree.id });
  if (hasText && pullRequest === 'ask') {
    const held = await holdScribePullRequest({ ctx, delegation, attempt, mountId, output });
    if (held.kind === 'failed') {
      return held;
    }
    return {
      kind: 'done',
      line: pullRequestAskTextOf({ pullRequest: held.pullRequest }),
      pullRequest: held.pullRequest,
      raisedPush: null,
    };
  }
  const gate = hasText ? await pullRequestPushGateOf({ ctx, delegation }) : null;
  if (gate !== null && gate.kind === 'blocked') {
    return { kind: 'failed', message: gate.message };
  }
  if (gate !== null && gate.kind === 'held') {
    return {
      kind: 'done',
      line: gate.message,
      pullRequest: {
        state: 'awaiting_push',
        mountId,
        grantId: null,
        textVersion: pullRequestTextVersionOf({
          attemptId: attempt.id,
          title: output.prTitle,
          body: output.prBody,
        }),
        title: output.prTitle,
        body: output.prBody,
        number: null,
        url: null,
        message: gate.message,
        startedAt: null,
      },
      raisedPush: gate.raise,
    };
  }
  const published = await ctx.ports.publishScribePullRequest({
    sessionId: tree.sessionId,
    mountId,
    agentId: delegation.childAgentId,
    output,
  });
  if (published.kind === 'failed') {
    return published;
  }
  return {
    kind: 'done',
    line: `Pull request #${published.number} is open: ${published.url}`,
    pullRequest: null,
    raisedPush: null,
  };
};
