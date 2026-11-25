import { formatError } from '@goodboy/ui';
import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import type { MergeTrainCar } from '../../../store/slices/pr-series/mergeTrain';
import { readyCarsOf } from '../../board/mergeTrain/readyCarsOf';
import type { MergeTrainAction, TrainRequestEntry } from '../contract/actions';
import { evaluateMobileMerge, mobileMergeFacts } from '../mobileConfinement';
import { doneResult, refusedResult } from './handlerResults';
import type { HandlerResult, StoreHandlerParams } from './handlerTypes';
import { sessionIdOf } from './ids';
import { bumpTrainSequence } from './startState';
import { sessionOfAction } from './targets';

export const MAX_TRAIN_LENGTH = 10;

const SHORT_SHA_LENGTH = 7;

type EntryParams = {
  readonly action: MergeTrainAction;
  readonly entry: TrainRequestEntry;
  readonly getStore: StoreHandlerParams<MergeTrainAction>['getStore'];
};

type CarResult =
  | { readonly kind: 'car'; readonly car: MergeTrainCar }
  | { readonly kind: 'refused'; readonly result: HandlerResult };

type RefusedCarParams = {
  readonly result: HandlerResult;
};

const refusedCar = ({ result }: RefusedCarParams): CarResult => ({
  kind: 'refused',
  result,
});

const carOf = ({ action, entry, getStore }: EntryParams): CarResult => {
  const store = getStore();
  const label = `#${entry.prNumber}`;
  if (
    sessionOfAction({
      store,
      workspaceId: action.workspaceId,
      sessionId: entry.sessionId,
    }) === null
  ) {
    return refusedCar({
      result: refusedResult({
        code: 'unknown-target',
        message: `${label} is not on your Mac.`,
      }),
    });
  }
  const sessionId = sessionIdOf({ value: entry.sessionId });
  const facts = mobileMergeFacts({ state: store, sessionId });
  if (facts.pr === null || facts.pr.number !== entry.prNumber) {
    return refusedCar({
      result: refusedResult({
        code: 'unknown-target',
        message: `${label} is not on this session.`,
      }),
    });
  }
  const head = facts.pr.headSha ?? '';
  if (head !== entry.expectedHeadSha) {
    return refusedCar({
      result: refusedResult({
        code: 'version-changed',
        message: `${label} moved after you looked.`,
        changes: [
          {
            label,
            was: entry.expectedHeadSha.slice(0, SHORT_SHA_LENGTH),
            now: head.slice(0, SHORT_SHA_LENGTH),
          },
        ],
      }),
    });
  }
  const gate = evaluateMobileMerge({ facts, method: action.method });
  if (!gate.ok) {
    return refusedCar({
      result: refusedResult({ code: 'not-mergeable', message: `${label} ${gate.reason}` }),
    });
  }
  const [car] = readyCarsOf({ state: store, rows: [{ sessionId, number: entry.prNumber }] });
  if (car === undefined) {
    return refusedCar({
      result: refusedResult({
        code: 'unknown-target',
        message: `${label} has no single branch to merge from.`,
      }),
    });
  }
  return {
    kind: 'car',
    car: {
      sessionId: car.sessionId,
      mountId: car.mountId,
      prNumber: car.number,
      repo: car.repo,
      base: car.base,
    },
  };
};

export const mergeTrainAction = async ({
  action,
  getStore,
}: StoreHandlerParams<MergeTrainAction>): Promise<HandlerResult> => {
  const { entries } = action;
  if (entries.length === 0 || entries.length > MAX_TRAIN_LENGTH) {
    return refusedResult({
      code: 'invalid-request',
      message: `A train takes 1 to ${MAX_TRAIN_LENGTH} pull requests.`,
    });
  }
  const keys = new Set(entries.map((entry) => `${entry.sessionId}#${entry.prNumber}`));
  if (keys.size !== entries.length) {
    return refusedResult({ code: 'invalid-request', message: 'A pull request is listed twice.' });
  }
  const live = getStore().mergeTrain;
  if (live !== null && live.outcome === null) {
    return refusedResult({ code: 'busy', message: 'Another train is running on your Mac.' });
  }
  const cars: MergeTrainCar[] = [];
  for (const entry of entries) {
    const picked = carOf({ action, entry, getStore });
    if (picked.kind === 'refused') {
      return picked.result;
    }
    cars.push(picked.car);
  }
  const store = getStore();
  void store.startMergeTrain({ method: action.method, cars }).catch((error: unknown) => {
    console.error('[bridge] merge train failed', formatError(error));
    store.reportError({ recovery: CHECK_STATE, title: "Couldn't merge in order", error });
  });
  bumpTrainSequence();
  return doneResult();
};
