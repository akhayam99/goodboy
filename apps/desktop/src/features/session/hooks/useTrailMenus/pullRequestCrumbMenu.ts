import { Plus } from 'lucide-react';
import type { CrumbMenuModel } from '@goodboy/ui';
import { openLens } from '../../openLens';
import { pullRequestMenu } from '../../trail/menus/pullRequestMenu';
import type { TrailMenuScope } from './trailMenuScope';

export const pullRequestCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel | null => {
  const { sessionId, pullRequests, selectedPrNumber, prNumber } = scope;
  if (pullRequests.length === 0) {
    return null;
  }
  return pullRequestMenu({
    prs: pullRequests,
    currentNumber: selectedPrNumber ?? prNumber,
    actions: [
      {
        id: 'new-pull-request',
        label: 'New pull request',
        icon: Plus,
        confirm: null,
        onRun: () => {
          scope.setPullRequestMode({ sessionId, mode: 'create_pr' });
          openLens({ sessionId, lens: 'pr' });
        },
      },
    ],
    onSelect: (pr) => {
      scope.setPullRequestMode({ sessionId, mode: 'overview' });
      void scope.selectSessionPr(sessionId, pr.number);
    },
  });
};
