import type { ResolveStage } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import { isRemoteMovedError } from '../../store/slices/resolve/remoteMovedError';
import { RESOLVE_WORD_LABEL } from './commentProjection';
import { SYNC_COPY } from './failedRunCopy';
import { shortSha } from './resolveItemCopy';

export type ResolveUiState =
  'new' | 'working' | 'needs_you' | 'ready' | 'approved' | 'resolved' | 'failed' | 'later';

export type ResolveFailedStep = 'run' | 'push' | 'reply' | 'resolve' | 'uncertain';

export type ResolveRowAction =
  'resolve' | 'answer' | 'review' | 'retry' | 'retry_reply' | 'open_github' | 'resume';

export type ResolveRowState = {
  readonly state: ResolveUiState;
  readonly node: WorkNodeState;
  readonly sentence: string | null;
  readonly action: ResolveRowAction | null;
  readonly failedStep: ResolveFailedStep | null;
  readonly isRemoteMoved: boolean;
};

type Params = {
  readonly stage: ResolveStage;
  readonly failedStep: ResolveFailedStep | null;
  readonly isLeftOpen: boolean;
  readonly pushedSha: string | null;
  readonly pushError: string | null;
  readonly runFailure: string;
  readonly provider?: string;
};

const uiStateOf = ({ stage }: { readonly stage: ResolveStage }): ResolveUiState => {
  switch (stage) {
    case 'new':
      return 'new';
    case 'working':
    case 'publishing':
      return 'working';
    case 'asking':
      return 'needs_you';
    case 'proposed':
      return 'ready';
    case 'approved':
      return 'approved';
    case 'resolved':
      return 'resolved';
    case 'failed':
      return 'failed';
    case 'parked':
      return 'later';
    default: {
      const exhaustive: never = stage;
      return exhaustive;
    }
  }
};

type FailedParams = {
  readonly provider: string;
  readonly step: ResolveFailedStep;
  readonly pushedSha: string | null;
  readonly pushError: string | null;
  readonly runFailure: string;
};

const failedSentence = ({
  provider,
  step,
  pushedSha,
  pushError,
  runFailure,
}: FailedParams): string => {
  switch (step) {
    case 'run':
      return runFailure;
    case 'push':
      if (isRemoteMovedError({ error: pushError })) {
        return SYNC_COPY.movedGeneric;
      }
      return pushError === null ? 'Nothing was pushed' : `Nothing was pushed: ${pushError}`;
    case 'reply':
      return pushedSha === null
        ? 'The reply was not posted'
        : `${shortSha({ sha: pushedSha })} is on origin. The reply was not posted`;
    case 'resolve':
      return `Reply posted. ${provider} did not resolve the thread`;
    case 'uncertain':
      return "We couldn't confirm the reply landed";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};

const failedAction = ({ step }: { readonly step: ResolveFailedStep }): ResolveRowAction => {
  switch (step) {
    case 'reply':
      return 'retry_reply';
    case 'uncertain':
      return 'open_github';
    case 'run':
    case 'push':
    case 'resolve':
      return 'retry';
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};

export const resolveRowState = ({
  stage,
  failedStep,
  isLeftOpen,
  pushedSha,
  pushError,
  runFailure,
  provider = 'GitHub',
}: Params): ResolveRowState => {
  const state = uiStateOf({ stage });
  switch (state) {
    case 'new':
      return {
        state,
        node: 'queued',
        sentence: null,
        action: 'resolve',
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'working':
      return {
        state,
        node: 'running',
        sentence: RESOLVE_WORD_LABEL.working,
        action: null,
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'needs_you':
      return {
        state,
        node: 'question',
        sentence: RESOLVE_WORD_LABEL.question,
        action: 'answer',
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'ready':
      return {
        state,
        node: 'ready',
        sentence: RESOLVE_WORD_LABEL.to_review,
        action: 'review',
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'approved':
      return {
        state,
        node: 'queued',
        sentence: RESOLVE_WORD_LABEL.ready,
        action: null,
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'resolved':
      return {
        state,
        node: 'done',
        sentence: isLeftOpen ? 'Replied, left open' : `Resolved on ${provider}`,
        action: null,
        failedStep: null,
        isRemoteMoved: false,
      };
    case 'failed': {
      const step = failedStep ?? 'run';
      return {
        state,
        node: 'failed',
        sentence: failedSentence({ provider, step, pushedSha, pushError, runFailure }),
        action: failedAction({ step }),
        failedStep: step,
        isRemoteMoved: step === 'push' && isRemoteMovedError({ error: pushError }),
      };
    }
    case 'later':
      return {
        state,
        node: 'skipped',
        sentence: RESOLVE_WORD_LABEL.left_open,
        action: 'resume',
        failedStep: null,
        isRemoteMoved: false,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
