import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import { NAMES } from '../../../shared/utils/names';
import { CalendarPage } from './CalendarPage';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const CalendarStudio = ({ workspaceId, onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.calendar}
    tone={CONCEPT_TONE.calendar}
    title={NAMES.calendar}
    onClose={onClose}
  >
    {() => <CalendarPage key={workspaceId} workspaceId={workspaceId} />}
  </StudioShell>
);
