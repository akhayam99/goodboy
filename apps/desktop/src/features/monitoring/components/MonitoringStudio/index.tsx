import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { MonitoringPage } from './MonitoringPage';

type Props = {
  readonly onClose: () => void;
};

export const MonitoringStudio = ({ onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.monitoring}
    tone={CONCEPT_TONE.monitoring}
    title="Monitoring"
    closeLabel="Close monitoring"
    onClose={onClose}
  >
    {() => <MonitoringPage />}
  </StudioShell>
);
