import type {
  MergePrAction,
  MergeTrainAction,
  MobileAction,
  StartSessionAction,
  StopTrainAction,
  TrainRequestEntry,
} from '../contract/actions';
import type { MergeMethod, SessionAccess, StartKind, TaskProvider } from '../contract/vocabulary';
import type { PhoneKind } from './actionLimits';
import { readerOf } from './actionReader';

export const PHONE_KINDS = [
  'mergePr',
  'mergeTrain',
  'startSession',
  'stopTrain',
] as const satisfies ReadonlyArray<MobileAction['kind'] & PhoneKind>;

export type PhoneAction = MergePrAction | MergeTrainAction | StartSessionAction | StopTrainAction;

type KindParams = {
  readonly kind: string;
};

export const phoneKindOf = ({ kind }: KindParams): PhoneKind | null =>
  PHONE_KINDS.find((candidate) => candidate === kind) ?? null;

const METHODS: ReadonlyArray<MergeMethod> = ['squash', 'merge', 'rebase'];
const ACCESS: ReadonlyArray<SessionAccess> = ['readOnly', 'askFirst', 'editsAllowed'];
const START_KINDS: ReadonlyArray<StartKind> = ['lead', 'leadPlan', 'agentScout'];
const PROVIDERS: ReadonlyArray<TaskProvider> = ['linear', 'sentry', 'gitlab', 'jira'];

type EntryParams = {
  readonly raw: unknown;
};

const trainEntryOf = ({ raw }: EntryParams): TrainRequestEntry | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const read = readerOf({ record: { ...raw } });
  const sessionId = read.id({ name: 'sessionId' });
  const prNumber = read.int({ name: 'prNumber' });
  const expectedHeadSha = read.id({ name: 'expectedHeadSha' });
  if (sessionId === null || prNumber === null || expectedHeadSha === null) {
    return null;
  }
  return { sessionId, prNumber, expectedHeadSha };
};

type TaskParams = {
  readonly raw: unknown;
};

type TaskRead = { readonly isValid: boolean; readonly task: StartSessionAction['task'] };

const taskOf = ({ raw }: TaskParams): TaskRead => {
  if (raw === null || raw === undefined) {
    return { isValid: true, task: null };
  }
  if (typeof raw !== 'object') {
    return { isValid: false, task: null };
  }
  const read = readerOf({ record: { ...raw } });
  const provider = read.pick({ name: 'provider', options: PROVIDERS });
  const key = read.id({ name: 'key' });
  if (provider === null || key === null) {
    return { isValid: false, task: null };
  }
  return { isValid: true, task: { provider, key } };
};

type ParseParams = {
  readonly raw: unknown;
};

export const parsePhoneAction = ({ raw }: ParseParams): PhoneAction | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record: Record<string, unknown> = { ...raw };
  const read = readerOf({ record });
  const actionId = read.id({ name: 'actionId' });
  const workspaceId = read.id({ name: 'workspaceId' });
  if (actionId === null || workspaceId === null) {
    return null;
  }
  const base = { actionId, workspaceId };
  switch (record.kind) {
    case 'mergePr': {
      const sessionId = read.id({ name: 'sessionId' });
      const prNumber = read.int({ name: 'prNumber' });
      const expectedHeadSha = read.id({ name: 'expectedHeadSha' });
      const method = read.pick({ name: 'method', options: METHODS });
      const shouldDeleteBranch = read.bool({ name: 'shouldDeleteBranch' });
      if (
        sessionId === null ||
        prNumber === null ||
        expectedHeadSha === null ||
        method === null ||
        shouldDeleteBranch === null
      ) {
        return null;
      }
      return {
        kind: 'mergePr',
        ...base,
        sessionId,
        prNumber,
        expectedHeadSha,
        method,
        shouldDeleteBranch,
      };
    }
    case 'mergeTrain': {
      const method = read.pick({ name: 'method', options: METHODS });
      const list = read.list({ name: 'entries' });
      const entries = list === null ? null : list.map((item) => trainEntryOf({ raw: item }));
      if (method === null || entries === null || entries.some((entry) => entry === null)) {
        return null;
      }
      return {
        kind: 'mergeTrain',
        ...base,
        method,
        entries: entries.flatMap((entry) => (entry === null ? [] : [entry])),
      };
    }
    case 'stopTrain': {
      const trainId = read.id({ name: 'trainId' });
      return trainId === null ? null : { kind: 'stopTrain', ...base, trainId };
    }
    case 'startSession': {
      const projectId = read.id({ name: 'projectId' });
      const goal = read.text({ name: 'goal' });
      const access = read.pick({ name: 'access', options: ACCESS });
      const startKind = read.pick({ name: 'startKind', options: START_KINDS });
      const task = taskOf({ raw: record.task });
      const presetValue = record.presetId;
      const presetId = read.id({ name: 'presetId' });
      const limitValue = record.limitUsd;
      const limitUsd = read.number({ name: 'limitUsd' });
      const isPresetValid = presetValue === null || presetValue === undefined || presetId !== null;
      const isLimitValid = limitValue === null || limitValue === undefined || limitUsd !== null;
      if (
        projectId === null ||
        goal === null ||
        access === null ||
        startKind === null ||
        !task.isValid ||
        !isPresetValid ||
        !isLimitValid
      ) {
        return null;
      }
      return {
        kind: 'startSession',
        ...base,
        projectId,
        goal,
        task: task.task,
        access,
        startKind,
        presetId,
        limitUsd,
      };
    }
    default:
      return null;
  }
};
