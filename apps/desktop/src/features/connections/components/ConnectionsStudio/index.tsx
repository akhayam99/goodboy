import type { Workspace } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NAMES } from '../../../../shared/utils/names';
import type { ConnectionsFocus } from '../../../../store/slices/navigation/studio';
import { leaveToolPage } from '../../leaveToolPage';
import { IntegrationDetail } from '../IntegrationDetail';
import { ConnectionsPage } from './ConnectionsPage';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: ConnectionsFocus | null;
  readonly onClose: () => void;
};

export const ConnectionsStudio = ({ currentWorkspace, focus, onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.connections}
    tone={CONCEPT_TONE.connections}
    title={NAMES.connections}
    onClose={onClose}
  >
    {() =>
      focus === null || currentWorkspace === null ? (
        <ConnectionsPage workspaceName={currentWorkspace?.name ?? null} />
      ) : (
        <IntegrationDetail
          key={focus.tool}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          tool={focus.tool}
          onUp={() => leaveToolPage({})}
        />
      )
    }
  </StudioShell>
);
