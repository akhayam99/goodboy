import type { Workspace } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NAMES } from '../../../../shared/utils/names';
import type { ConnectionsFocus } from '../../connectionsFocus';
import { ConnectionsFocusView } from './ConnectionsFocusView';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus?: ConnectionsFocus | null;
  readonly onClose: () => void;
};

export const ConnectionsStudio = ({ currentWorkspace, focus = null, onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.connections}
    tone={CONCEPT_TONE.connections}
    title={NAMES.connections}
    onClose={onClose}
  >
    {() => <ConnectionsFocusView currentWorkspace={currentWorkspace} focus={focus} />}
  </StudioShell>
);
