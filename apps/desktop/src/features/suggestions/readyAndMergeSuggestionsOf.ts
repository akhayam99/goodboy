import type { SessionId } from '@goodboy/types';
import type { SessionSuggestion } from './types';
import type { SuggestionMount } from './deriveNextSteps';

type Params = {
  readonly mount: SuggestionMount;
  readonly pr: NonNullable<SuggestionMount['pr']>;
  readonly sessionId: SessionId;
};

export const readyAndMergeSuggestionsOf = ({
  mount,
  pr,
  sessionId,
}: Params): ReadonlyArray<SessionSuggestion> => {
  const suggestions: SessionSuggestion[] = [];
  if (pr.isDraft && pr.checks === 'success') {
    suggestions.push({
      id: `mark-ready:${mount.mountId}`,
      kind: 'mark-ready',
      priority: 43,
      band: 2,
      title: `Mark #${pr.number} ready for review`,
      detail: 'All checks passed',
      sessionId,
      targetKey: `pr:${mount.mountId}`,
      fingerprint: `mark-ready:${mount.mountId}:${pr.number}`,
      payload: {
        mountId: mount.mountId,
        projectName: mount.projectName,
        prNumber: pr.number,
      },
    });
  }
  if (
    !pr.isDraft &&
    pr.reviewDecision === 'approved' &&
    pr.checks === 'success' &&
    pr.mergeable === true
  ) {
    suggestions.push({
      id: `merge-pr:${mount.mountId}`,
      kind: 'merge-pr',
      priority: 44,
      band: 2,
      title: `Merge #${pr.number}`,
      detail: 'Approved, checks passed',
      sessionId,
      targetKey: `pr:${mount.mountId}`,
      fingerprint: `merge-pr:${mount.mountId}:${pr.number}`,
      payload: {
        mountId: mount.mountId,
        projectName: mount.projectName,
        prNumber: pr.number,
        defaultMethod: 'squash',
      },
    });
  }
  return suggestions;
};
