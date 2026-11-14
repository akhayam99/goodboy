import type { ReactNode } from 'react';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import {
  LeadPermissionsChip,
  type LeadPermissionsTarget,
} from '../../permissions/LeadPermissionsChip';

type Props = {
  readonly target: LeadPermissionsTarget;
  readonly children: ReactNode;
};

export const WorkAwareChip = ({ target, children }: Props) =>
  useIsWorkOn() ? <LeadPermissionsChip target={target} /> : children;
