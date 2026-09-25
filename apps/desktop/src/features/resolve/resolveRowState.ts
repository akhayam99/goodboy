import type { ResolveStage } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import type { ResolveProposalKind } from '../../store/slices/resolve/resolveProposalKind';
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
};

type Params = {
  readonly stage: ResolveStage;
  readonly proposalKind: ResolveProposalKind;
  readonly failedStep: ResolveFailedStep | null;
  readonly isLeftOpen: boolean;
  readonly pushedSha: string | null;
  readonly pushError: string | null;
};

export const RESOLVE_ROW_ACTION_LABEL: Record<ResolveRowAction, string> = {
  resolve: 'Resolve',
  answer: 'Answer',
  review: 'Review',
  retry: 'Retry',
  retry_reply: 'Retry reply',
  open_github: 'Open on GitHub',
  resume: 'Resume',
};

export const RESOLVE_UI_STATE_LABEL: Record<ResolveUiState, string> = {
  new: 'New',
  working: 'Working',
  needs_you: 'Needs you',
  ready: 'Ready to review',
  approved: 'Approved',
  resolved: 'Resolved',
  failed: 'Failed',
  later: 'Later',
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

const readySentence = ({
  proposalKind,
}: {
  readonly proposalKind: ResolveProposalKind;
}): string => {
  switch (proposalKind) {
    case 'fix':
      return 'Fix ready';
    case 'reply_only':
      return 'Reply ready';
    case 'none':
      return 'No change proposed';
    default: {
      const exhaustive: never = proposalKind;
      return exhaustive;
    }
  }
};

type FailedParams = {
  readonly step: ResolveFailedStep;
  readonly pushedSha: string | null;
  readonly pushError: string | null;
};

const failedSentence = ({ step, pushedSha, pushError }: FailedParams): string => {
  switch (step) {
    case 'run':
      return 'The run stopped on an error';
    case 'push':
      return pushError === null ? 'Nothing was pushed' : `Nothing was pushed: ${pushError}`;
    case 'reply':
      return pushedSha === null
        ? 'The reply was not posted'
        : `${shortSha({ sha: pushedSha })} is on origin. The reply was not posted`;
    case 'resolve':
      return 'Reply posted. GitHub did not resolve the thread';
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
  proposalKind,
  failedStep,
  isLeftOpen,
  pushedSha,
  pushError,
}: Params): ResolveRowState => {
  const state = uiStateOf({ stage });
  switch (state) {
    case 'new':
      return { state, node: 'queued', sentence: null, action: 'resolve', failedStep: null };
    case 'working':
      return { state, node: 'running', sentence: 'Working', action: null, failedStep: null };
    case 'needs_you':
      return { state, node: 'question', sentence: 'Needs you', action: 'answer', failedStep: null };
    case 'ready':
      return {
        state,
        node: 'ready',
        sentence: readySentence({ proposalKind }),
        action: 'review',
        failedStep: null,
      };
    case 'approved':
      return { state, node: 'queued', sentence: 'Approved', action: null, failedStep: null };
    case 'resolved':
      return {
        state,
        node: 'done',
        sentence: isLeftOpen ? 'Replied, left open' : 'Resolved on GitHub',
        action: null,
        failedStep: null,
      };
    case 'failed': {
      const step = failedStep ?? 'run';
      return {
        state,
        node: 'failed',
        sentence: failedSentence({ step, pushedSha, pushError }),
        action: failedAction({ step }),
        failedStep: step,
      };
    }
    case 'later':
      return { state, node: 'skipped', sentence: 'Later', action: 'resume', failedStep: null };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
