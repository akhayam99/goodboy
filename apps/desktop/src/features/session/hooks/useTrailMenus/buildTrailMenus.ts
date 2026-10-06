import type { CrumbMenuModel } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { agentCrumbMenu } from './agentCrumbMenu';
import { artifactCrumbMenu } from './artifactCrumbMenu';
import { diffBranchCrumbMenu } from './diffBranchCrumbMenu';
import { pageCrumbMenu } from './pageCrumbMenu';
import { pullRequestCrumbMenu } from './pullRequestCrumbMenu';
import { reviewThreadCrumbMenu } from './reviewThreadCrumbMenu';
import type { TrailMenuInputs } from './trailMenuInputs';
import { createTrailMenuScope, type TrailMenuScope } from './trailMenuScope';
import { workflowRunCrumbMenu } from './workflowRunCrumbMenu';

type Params = {
  readonly inputs: TrailMenuInputs;
  readonly crumbs: ReadonlyArray<BreadcrumbCrumb>;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
};

type CrumbParams = {
  readonly scope: TrailMenuScope;
  readonly crumbId: string;
};

const menuForCrumb = ({ scope, crumbId }: CrumbParams): CrumbMenuModel | null => {
  switch (crumbId) {
    case 'workflow-run':
      return workflowRunCrumbMenu(scope);
    case 'pr-number':
      return pullRequestCrumbMenu(scope);
    case 'review-thread':
      return reviewThreadCrumbMenu(scope);
    case 'branch':
      return diffBranchCrumbMenu(scope);
    case 'artifact':
      return artifactCrumbMenu(scope);
    case 'selected-child':
      return scope.selected === null ? null : agentCrumbMenu(scope, scope.selected);
    case 'selected-parent':
      return scope.parent === null ? null : agentCrumbMenu(scope, scope.parent);
    case 'selected-root':
      return scope.root === null ? null : agentCrumbMenu(scope, scope.root);
    default:
      return null;
  }
};

export const buildTrailMenus = ({
  inputs,
  crumbs,
  activeLens,
  isBranchless,
}: Params): ReadonlyMap<string, CrumbMenuModel> => {
  const menus = new Map<string, CrumbMenuModel>();
  const scope = createTrailMenuScope(inputs);
  crumbs.forEach((crumb, index) => {
    const isDepthOne = crumbs.length === 1 ? index === 0 : index === 1;
    const menu =
      isDepthOne && crumb.id !== 'branch'
        ? pageCrumbMenu({ scope, activeLens, isBranchless })
        : menuForCrumb({ scope, crumbId: crumb.id });
    if (menu !== null) {
      menus.set(crumb.id, menu);
    }
  });
  return menus;
};
