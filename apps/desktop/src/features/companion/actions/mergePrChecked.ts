import type { MountId } from '@goodboy/types';
import type { MergePrAction } from '../contract/actions';
import { evaluateMobileMerge, mobileMergeFacts } from '../mobileConfinement';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { HandlerResult, StoreHandlerParams } from './handlerTypes';
import { sessionIdOf } from './ids';
import { sessionOfAction } from './targets';

const SHORT_SHA_LENGTH = 7;

type ShaParams = {
  readonly sha: string;
};

const shortShaOf = ({ sha }: ShaParams): string => sha.slice(0, SHORT_SHA_LENGTH);

export const mergePrChecked = async ({
  action,
  getStore,
}: StoreHandlerParams<MergePrAction>): Promise<HandlerResult> => {
  const store = getStore();
  const sessionId = sessionIdOf({ value: action.sessionId });
  if (
    sessionOfAction({
      store,
      workspaceId: action.workspaceId,
      sessionId: action.sessionId,
    }) === null
  ) {
    return refusedResult({ code: 'unknown-target', message: "This session isn't on your Mac." });
  }
  const facts = mobileMergeFacts({ state: store, sessionId });
  const pr = facts.pr;
  if (pr === null || pr.number !== action.prNumber) {
    return refusedResult({
      code: 'unknown-target',
      message: `Pull request #${action.prNumber} isn't on this session.`,
    });
  }
  if (pr.state === 'merged') {
    return refusedResult({ code: 'already-decided', message: 'Merged on your Mac.' });
  }
  const head = pr.headSha ?? '';
  if (head !== action.expectedHeadSha) {
    return refusedResult({
      code: 'version-changed',
      message: 'The branch moved after you looked.',
      changes: [
        {
          label: 'Head',
          was: shortShaOf({ sha: action.expectedHeadSha }),
          now: shortShaOf({ sha: head }),
        },
      ],
    });
  }
  const gate = evaluateMobileMerge({ facts, method: action.method });
  if (!gate.ok) {
    return refusedResult({ code: 'not-mergeable', message: gate.reason });
  }
  const mountId: MountId | null = facts.mountId;
  try {
    await store.mergePr(sessionId, gate.pr.number, gate.method, {
      expectedHeadSha: head,
      ...(mountId === null ? {} : { mountId }),
    });
  } catch (error) {
    console.error('[bridge] mergePr failed', error);
    return failedResult({ error: 'The merge failed on your Mac.' });
  }
  if (action.shouldDeleteBranch && mountId !== null) {
    await store
      .runAfterMergeCleanup({
        sessionId,
        mountId,
        expectedBranch: gate.pr.headBranch,
        mergedHeadSha: head,
        isRequested: true,
      })
      .catch((error: unknown) => console.error('[bridge] branch cleanup failed', error));
  }
  return doneResult();
};
