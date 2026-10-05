import type { ExtractedScribeText } from '@goodboy/core';
import type { PullRequestState } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { patchScribeWork } from './requestScribe';
import { isUntouchedScribeBody, referenceLinesOf, signScribeBody } from './scribeSignature';
import type { GetFn, OpenScribePullRequestInput, ScribeWork, SetFn } from './types';

const NO_TEXT = 'Scribe wrote no title or description.';

const liveOf = ({ pr }: { readonly pr: PullRequestState | null }): PullRequestState | null =>
  pr !== null && pr.state !== 'merged' && pr.state !== 'closed' ? pr : null;

const signedBodyOf = ({
  output,
  currentBody,
}: {
  readonly output: ExtractedScribeText;
  readonly currentBody: string;
}): string | null => {
  if (output.prBody === null) {
    return null;
  }
  const references = referenceLinesOf({ body: currentBody });
  return signScribeBody({
    body: references.length === 0 ? output.prBody : `${output.prBody}\n\n${references.join('\n')}`,
  });
};

export const openScribePullRequest = (set: SetFn, get: GetFn) => {
  const settleOnLive = async ({
    key,
    work,
    output,
    pr,
  }: {
    readonly key: string;
    readonly work: ScribeWork;
    readonly output: ExtractedScribeText;
    readonly pr: PullRequestState;
  }): Promise<void> => {
    const request = { number: pr.number, url: pr.url };
    const body = signedBodyOf({ output, currentBody: pr.body });
    const title = output.prTitle ?? undefined;
    const isOurs = isUntouchedScribeBody({ body: pr.body });
    const isStale =
      (body !== null && body !== pr.body) || (title !== undefined && title !== pr.title);
    if (!isOurs || !isStale) {
      patchScribeWork({
        set,
        key,
        patch: { status: 'created', error: null, pullRequest: request },
      });
      return;
    }
    patchScribeWork({ set, key, patch: { status: 'creating', error: null } });
    try {
      await get().editPr(work.sessionId, pr.number, {
        ...(title === undefined ? {} : { title }),
        ...(body === null ? {} : { body }),
      });
      patchScribeWork({
        set,
        key,
        patch: { status: 'created', error: null, pullRequest: request },
      });
    } catch (error) {
      patchScribeWork({
        set,
        key,
        patch: { status: 'failed', error: formatError(error), pullRequest: request },
      });
    }
  };

  return async ({ key }: OpenScribePullRequestInput): Promise<void> => {
    const work = get().scribeWork[key];
    if (
      work === undefined ||
      work.task.kind !== 'pr' ||
      work.status === 'creating' ||
      work.status === 'writing'
    ) {
      return;
    }
    const output = work.output;
    if (output === null || (output.prTitle === null && output.prBody === null)) {
      patchScribeWork({ set, key, patch: { status: 'failed', error: NO_TEXT } });
      return;
    }
    const live = liveOf({ pr: get().mountGithub[work.mountId]?.pr ?? null });
    if (live !== null) {
      await settleOnLive({ key, work, output, pr: live });
      return;
    }
    patchScribeWork({ set, key, patch: { status: 'creating', error: null, pullRequest: null } });
    try {
      const created = await get().createPrForSession({
        sessionId: work.sessionId,
        mountId: work.mountId,
        title: output.prTitle ?? '',
        body: output.prBody ?? '',
        draft: work.task.isDraft,
        isScribeBody: true,
        ...(work.task.base === null ? {} : { base: work.task.base }),
      });
      const pr = get().mountGithub[work.mountId]?.pr ?? null;
      const number = created.number ?? pr?.number ?? null;
      const url = created.url ?? pr?.url ?? null;
      patchScribeWork({
        set,
        key,
        patch: {
          status: 'created',
          error: null,
          pullRequest: number === null || url === null ? null : { number, url },
        },
      });
    } catch (error) {
      patchScribeWork({ set, key, patch: { status: 'failed', error: formatError(error) } });
    }
  };
};
