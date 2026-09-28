import type { ResolveItemActionId } from './resolveItemActions';

export type ResolveDecisionVerb = 'take_up' | 'reopen';

export const resolveDecisionVerb = ({
  actionId,
}: {
  readonly actionId: ResolveItemActionId;
}): ResolveDecisionVerb | null => {
  switch (actionId) {
    case 'resume_comment':
      return 'take_up';
    case 'change_decision':
    case 'review_changed':
    case 'reopen_locally':
      return 'reopen';
    case 'fix_it':
    case 'discuss':
    case 'close':
    case 'resolve':
    case 'check_publication':
    case 'open_github':
    case 'stop_run':
    case 'view_agent':
      return null;
    default: {
      const exhaustive: never = actionId;
      return exhaustive;
    }
  }
};
