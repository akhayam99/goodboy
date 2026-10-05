import { extractScribeText, type ExtractedScribeText } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { hasScribeText, mergeScribeOutput } from './mergeScribeOutput';
import { patchScribeWork } from './requestScribe';
import { isUntouchedScribeBody, referenceLinesOf, signScribeBody } from './scribeSignature';
import type { GetFn, ScribeTask, SetFn, SettleScribeInput } from './types';

const hasWhatTheTaskNeeds = ({
  task,
  output,
}: {
  readonly task: ScribeTask;
  readonly output: ExtractedScribeText;
}): boolean => {
  if (task.kind === 'commit-message') {
    return output.commitMessages.length > 0;
  }
  if (task.kind === 'pr-update') {
    return output.prBody !== null;
  }
  return output.prTitle !== null || output.prBody !== null;
};

export const settleScribe = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    assistantText,
    hasFailed,
  }: SettleScribeInput): Promise<void> => {
    const key = get().scribeAgents[agentId];
    const work = key === undefined ? undefined : get().scribeWork[key];
    if (key === undefined || work === undefined || work.sessionId !== sessionId) {
      return;
    }
    const output = extractScribeText(assistantText);
    if (work.status !== 'writing') {
      if (work.task.kind !== 'pr' || hasFailed || !hasScribeText({ output })) {
        return;
      }
      patchScribeWork({
        set,
        key,
        patch: { output: mergeScribeOutput({ previous: work.output, next: output }) },
      });
      await get().openScribePullRequest({ key });
      return;
    }
    if (work.task.kind !== 'pr') {
      set((state) => {
        const next = { ...state.scribeAgents };
        delete next[agentId];
        return { scribeAgents: next };
      });
    }
    if (hasFailed || !hasWhatTheTaskNeeds({ task: work.task, output })) {
      patchScribeWork({
        set,
        key,
        patch: {
          status: 'failed',
          output,
          error: hasFailed ? 'Scribe stopped before it finished.' : 'Scribe wrote no text.',
        },
      });
      return;
    }
    patchScribeWork({ set, key, patch: { status: 'ready', output, error: null } });
    if (work.task.kind === 'pr') {
      await get().openScribePullRequest({ key });
      return;
    }
    if (work.task.kind !== 'pr-update' || output.prBody === null) {
      return;
    }
    const pr = get().mountGithub[work.mountId]?.pr ?? null;
    if (
      pr === null ||
      pr.number !== work.task.prNumber ||
      !isUntouchedScribeBody({ body: pr.body })
    ) {
      return;
    }
    const references = referenceLinesOf({ body: pr.body });
    const body = signScribeBody({
      body:
        references.length === 0 ? output.prBody : `${output.prBody}\n\n${references.join('\n')}`,
    });
    await get()
      .editPr(sessionId, pr.number, { body })
      .catch((error: unknown) => {
        patchScribeWork({ set, key, patch: { error: formatError(error) } });
      });
  };
};
