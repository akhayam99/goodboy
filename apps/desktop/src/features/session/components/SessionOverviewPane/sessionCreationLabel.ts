import type { SessionCreation } from '../../../../store/slices/session-view';

type Params = {
  readonly creation: SessionCreation;
};

export const sessionCreationLabel = ({ creation }: Params): string => {
  if (creation.kind === 'branch') {
    return creation.label ?? 'Working on the branch';
  }
  if (creation.kind === 'workflow') {
    return creation.label == null ? 'Starting a workflow' : `Starting ${creation.label}`;
  }
  return creation.label == null ? 'Creating an agent' : `Creating ${creation.label}`;
};
