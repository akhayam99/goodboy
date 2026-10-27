import { isRecord } from '@goodboy/types/helpers';

export type PublishMode = 'push' | 'force';

export type DelegatePublish = Readonly<{
  mode: PublishMode;
  reviewerReportId: string | null;
  isContentChanging: boolean;
}>;

export type PublishState =
  'pushing' | 'awaiting_confirm' | 'pushed' | 'declined' | 'failed' | 'put_back';

export type ResultPublish = Readonly<{
  mode: PublishMode;
  state: PublishState;
  branch: string | null;
  sha: string | null;
  leaseSha: string | null;
  backupRef: string | null;
  message: string | null;
  isRetryable: boolean;
  isConfirmed: boolean;
  tries: number;
  reviewerReportId: string | null;
  isContentChanging: boolean;
}>;

export const PUBLISH_MAX_TRIES = 2;

type TextParams = {
  readonly value: unknown;
};

const textOf = ({ value }: TextParams): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

type RawParams = {
  readonly value: unknown;
};

export const parseDelegatePublish = ({ value }: RawParams): DelegatePublish | null | 'invalid' => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value === 'push' || value === 'force') {
    return { mode: value, reviewerReportId: null, isContentChanging: false };
  }
  if (!isRecord(value) || (value['mode'] !== 'push' && value['mode'] !== 'force')) {
    return 'invalid';
  }
  return {
    mode: value['mode'],
    reviewerReportId: textOf({ value: value['reviewer'] }),
    isContentChanging: value['changesContent'] === true,
  };
};

type RequestParams = {
  readonly request: unknown;
};

export const publishOfRequest = ({ request }: RequestParams): DelegatePublish | null => {
  if (!isRecord(request)) {
    return null;
  }
  const publish = request['publish'];
  if (!isRecord(publish) || (publish['mode'] !== 'push' && publish['mode'] !== 'force')) {
    return null;
  }
  return {
    mode: publish['mode'],
    reviewerReportId: textOf({ value: publish['reviewerReportId'] }),
    isContentChanging: publish['isContentChanging'] === true,
  };
};

type GateParams = {
  readonly outcome: string;
  readonly exit: string;
  readonly completion: string;
  readonly checksVerdict: 'green' | 'red' | 'not_checked' | null;
};

export type PublishGate = Readonly<{ kind: 'go' }> | Readonly<{ kind: 'held'; message: string }>;

export const CHECKS_RED_HOLD = 'the checks are red';

export const publishGateOf = ({
  outcome,
  exit,
  completion,
  checksVerdict,
}: GateParams): PublishGate => {
  if (outcome !== 'completed' || exit !== 'ok' || completion !== 'done') {
    return { kind: 'held', message: 'the agent did not finish its work' };
  }
  if (checksVerdict === 'red') {
    return { kind: 'held', message: CHECKS_RED_HOLD };
  }
  return { kind: 'go' };
};

type PublishTextParams = {
  readonly publish: ResultPublish;
};

type ShaParams = {
  readonly sha: string | null;
};

const shortOf = ({ sha }: ShaParams): string =>
  sha === null ? 'the checked commit' : sha.slice(0, 7);

type BranchParams = {
  readonly branch: string | null;
};

const nameOf = ({ branch }: BranchParams): string => (branch === null ? 'the branch' : branch);

export const publishTextOf = ({ publish }: PublishTextParams): string => {
  const branch = nameOf({ branch: publish.branch });
  const short = shortOf({ sha: publish.sha });
  switch (publish.state) {
    case 'pushing':
      return `Pushing ${branch} at ${short}`;
    case 'awaiting_confirm':
      return `Waiting for you to confirm the force push of ${branch}`;
    case 'pushed':
      if (publish.mode === 'push') {
        return `Pushed ${branch} at ${short}`;
      }
      return publish.backupRef === null
        ? `Force pushed ${branch} at ${short}, it was not online before`
        : `Force pushed ${branch} at ${short}, the earlier online version is kept as a backup`;
    case 'declined':
      return `Not pushed: you declined the push of ${branch}`;
    case 'put_back':
      return publish.message === null
        ? `Put back: ${branch} is online as it was when the agent started`
        : `Put back: ${branch} is online as it was when the agent started. ${publish.message}`;
    case 'failed':
      return `Not pushed: ${publish.message ?? 'the push did not finish'}`;
    default: {
      const exhaustive: never = publish.state;
      return exhaustive;
    }
  }
};

type CanParams = {
  readonly publish: ResultPublish;
};

export const canRetryPublish = ({ publish }: CanParams): boolean =>
  publish.state === 'failed' && publish.isRetryable && publish.tries < PUBLISH_MAX_TRIES;

export const canPutBackPublish = ({ publish }: CanParams): boolean =>
  publish.state === 'pushed' &&
  publish.mode === 'force' &&
  publish.backupRef !== null &&
  publish.leaseSha !== null &&
  publish.sha !== null &&
  publish.branch !== null;

const STATES: ReadonlyArray<PublishState> = [
  'pushing',
  'awaiting_confirm',
  'pushed',
  'declined',
  'failed',
  'put_back',
];

type ResultParams = {
  readonly result: unknown;
};

export const publishOfResult = ({ result }: ResultParams): ResultPublish | null => {
  if (!isRecord(result) || !isRecord(result['verified'])) {
    return null;
  }
  const raw = result['verified']['publish'];
  if (!isRecord(raw)) {
    return null;
  }
  const state = STATES.find((candidate) => candidate === raw['state']);
  const mode = raw['mode'];
  if (state === undefined || (mode !== 'push' && mode !== 'force')) {
    return null;
  }
  const tries = raw['tries'];
  return {
    mode,
    state,
    branch: textOf({ value: raw['branch'] }),
    sha: textOf({ value: raw['sha'] }),
    leaseSha: typeof raw['leaseSha'] === 'string' ? raw['leaseSha'] : null,
    backupRef: textOf({ value: raw['backupRef'] }),
    message: textOf({ value: raw['message'] }),
    isRetryable: raw['isRetryable'] === true,
    isConfirmed: raw['isConfirmed'] === true,
    tries: typeof tries === 'number' && Number.isInteger(tries) ? tries : 0,
    reviewerReportId: textOf({ value: raw['reviewerReportId'] }),
    isContentChanging: raw['isContentChanging'] === true,
  };
};
