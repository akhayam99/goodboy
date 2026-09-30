import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import type { CrumbMenuModel } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { buildTrailMenus } from './buildTrailMenus';
import { useTrailMenuInputs } from './useTrailMenuInputs';

type Params = {
  readonly session: Session;
  readonly crumbs: ReadonlyArray<BreadcrumbCrumb>;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
};

export const useTrailMenus = ({
  session,
  crumbs,
  activeLens,
  isBranchless,
}: Params): ReadonlyMap<string, CrumbMenuModel> => {
  const inputs = useTrailMenuInputs({ session });
  return useMemo(
    () => buildTrailMenus({ inputs, crumbs, activeLens, isBranchless }),
    [inputs, crumbs, activeLens, isBranchless],
  );
};
