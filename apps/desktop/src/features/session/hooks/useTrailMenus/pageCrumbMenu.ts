import type { CrumbMenuAction, CrumbMenuModel } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import { sessionTitle } from '../../sessionTitle';
import { openLens } from '../../openLens';
import { newArtifactEventName } from '../../../artifacts/newArtifactEventName';
import { pageMenu } from '../../trail/menus/pageMenu';
import { newArtifactAction } from '../../trail/menus/crumbActions';
import { startAgentAction, startWorkflowAction } from './trailMenuActions';
import type { TrailMenuScope } from './trailMenuScope';

type Params = {
  readonly scope: TrailMenuScope;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
};

export const pageCrumbMenu = ({ scope, activeLens, isBranchless }: Params): CrumbMenuModel => {
  const { session, sessionId, setFocusedArtifactId, setFocusedWorkflowRun } = scope;
  const newArtifact = newArtifactAction({
    onRun: () => {
      setFocusedArtifactId(sessionId, null);
      openLens({ sessionId, lens: 'plans' });
      window.requestAnimationFrame(() =>
        window.dispatchEvent(new CustomEvent(newArtifactEventName(sessionId))),
      );
    },
  });
  const pageActions: Partial<Record<LensKind, ReadonlyArray<CrumbMenuAction>>> = {
    agents: [startAgentAction({ sessionId })],
    workflows: [startWorkflowAction({ sessionId })],
    plans: [newArtifact],
  };
  return pageMenu({
    destinations: scope.destinations,
    activeLens,
    isBranchless,
    sessionTitle: sessionTitle({ session }),
    summaries: scope.summaries,
    actions: activeLens === null ? [] : (pageActions[activeLens] ?? []),
    onSelect: (lens) => {
      setFocusedArtifactId(sessionId, null);
      setFocusedWorkflowRun(sessionId, null);
      openLens({ sessionId, lens });
    },
  });
};
