import type { ResolveStage } from '@goodboy/types';

export type ResolveStageEvent =
  | { readonly kind: 'run_started' }
  | { readonly kind: 'run_asked' }
  | { readonly kind: 'run_reported' }
  | { readonly kind: 'run_failed' }
  | { readonly kind: 'run_stopped' }
  | { readonly kind: 'user_answered' }
  | { readonly kind: 'user_approved' }
  | { readonly kind: 'user_unapproved' }
  | { readonly kind: 'comment_edited' }
  | { readonly kind: 'user_parked' }
  | { readonly kind: 'user_resumed'; readonly hasProposal: boolean }
  | { readonly kind: 'publish_started' }
  | { readonly kind: 'delivered' }
  | { readonly kind: 'step_failed' }
  | { readonly kind: 'interrupted' }
  | { readonly kind: 'retry'; readonly target: 'run' | 'publishing' }
  | { readonly kind: 'github_resolved' }
  | { readonly kind: 'github_reopened'; readonly hasProposal: boolean };

type Params = {
  readonly stage: ResolveStage;
  readonly event: ResolveStageEvent;
};

const fromNew = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'run_started':
      return 'working';
    case 'run_asked':
      return 'asking';
    case 'run_reported':
      return 'proposed';
    case 'user_approved':
      return 'approved';
    case 'user_parked':
      return 'parked';
    default:
      return null;
  }
};

const fromWorking = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'run_asked':
      return 'asking';
    case 'run_reported':
      return 'proposed';
    case 'run_failed':
      return 'failed';
    case 'run_stopped':
      return 'new';
    default:
      return null;
  }
};

const fromAsking = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'user_answered':
    case 'run_started':
      return 'working';
    case 'run_reported':
      return 'proposed';
    case 'run_failed':
      return 'failed';
    case 'run_stopped':
      return 'new';
    case 'user_parked':
      return 'parked';
    default:
      return null;
  }
};

const fromProposed = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'user_approved':
      return 'approved';
    case 'run_started':
      return 'working';
    case 'run_asked':
      return 'asking';
    case 'run_reported':
    case 'comment_edited':
      return 'proposed';
    case 'user_parked':
      return 'parked';
    default:
      return null;
  }
};

const fromApproved = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'publish_started':
      return 'publishing';
    case 'user_unapproved':
    case 'comment_edited':
      return 'proposed';
    case 'run_started':
      return 'working';
    default:
      return null;
  }
};

const fromPublishing = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'delivered':
      return 'resolved';
    case 'step_failed':
    case 'interrupted':
      return 'failed';
    default:
      return null;
  }
};

const fromFailed = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null => {
  switch (event.kind) {
    case 'retry':
      return event.target === 'run' ? 'working' : 'publishing';
    case 'run_started':
      return 'working';
    case 'publish_started':
      return 'publishing';
    case 'run_reported':
      return 'proposed';
    case 'user_approved':
      return 'approved';
    case 'user_parked':
      return 'parked';
    default:
      return null;
  }
};

const fromParked = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null =>
  event.kind === 'user_resumed' ? (event.hasProposal ? 'proposed' : 'new') : null;

const fromResolved = ({ event }: { readonly event: ResolveStageEvent }): ResolveStage | null =>
  event.kind === 'github_reopened' ? (event.hasProposal ? 'proposed' : 'new') : null;

const transition = ({ stage, event }: Params): ResolveStage | null => {
  switch (stage) {
    case 'new':
      return fromNew({ event });
    case 'working':
      return fromWorking({ event });
    case 'asking':
      return fromAsking({ event });
    case 'proposed':
      return fromProposed({ event });
    case 'approved':
      return fromApproved({ event });
    case 'publishing':
      return fromPublishing({ event });
    case 'failed':
      return fromFailed({ event });
    case 'parked':
      return fromParked({ event });
    case 'resolved':
      return fromResolved({ event });
    default: {
      const exhaustive: never = stage;
      return exhaustive;
    }
  }
};

export const nextStage = ({ stage, event }: Params): ResolveStage => {
  if (event.kind === 'github_resolved') {
    return 'resolved';
  }
  return transition({ stage, event }) ?? stage;
};
