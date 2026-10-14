import { Band } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useLiveAutoTreeCount } from '../../../auto/useLiveAutoTreeCount';
import { AutoExperimentField } from './AutoExperimentField';

export const ExperimentsBand = () => {
  const runningCount = useLiveAutoTreeCount();
  return (
    <Band
      inset="content"
      label="Experiments"
      hint="Early features that are still being tried out."
      icon={<CONCEPT_ICONS.experiments size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col">
        <AutoExperimentField runningCount={runningCount} />
      </div>
    </Band>
  );
};
