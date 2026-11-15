import type { Workspace } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NAMES } from '../../../../shared/utils/names';
import { ConnectionsPage } from './ConnectionsPage';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly onClose: () => void;
};

export const ConnectionsStudio = ({ currentWorkspace, onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.connections}
    tone={CONCEPT_TONE.connections}
    title={NAMES.connections}
    onClose={onClose}
  >
    {() => <ConnectionsPage workspaceName={currentWorkspace?.name ?? null} />}
  </StudioShell>
);
