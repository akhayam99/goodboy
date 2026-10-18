import { useMemo } from 'react';
import type { PortRow } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import type { PortLayer } from '../../../actions/kinds/port';
import type { PortActionTarget } from '../../../actions/types';
import { portLabel } from '../../portLabel';
import { portOwnerPresentation } from '../../portOwnerPresentation';
import { portTargetOf } from '../../portTarget';

type Params = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly isProcess?: boolean;
};

export const usePortTarget = ({ row, layer, isProcess = false }: Params): PortActionTarget => {
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const ownerLabel = portOwnerPresentation({ row, projects, sessionMounts })?.label ?? null;
  const description = portLabel({ row });
  return useMemo(
    () => portTargetOf({ row, layer, description, ownerLabel, isProcess }),
    [row, layer, description, ownerLabel, isProcess],
  );
};
