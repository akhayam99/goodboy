import { ROLE_LABEL } from '../../../../session/agent-kind';
import type { SavedStep } from '../../../savedSteps';

type Params = {
  readonly step: SavedStep;
};

export const isRoleRepeated = ({ step }: Params): boolean =>
  ROLE_LABEL[step.role].toLowerCase() === step.name.trim().toLowerCase();
