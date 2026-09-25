import { Chip } from '@goodboy/ui';
import {
  stateDescription,
  type StatePresentation,
} from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly presentation: StatePresentation | null;
};

export const ArtifactStateChip = ({ presentation }: Props) => {
  if (presentation === null) {
    return null;
  }
  const Icon = presentation.icon;
  return (
    <Chip
      tone={presentation.tone}
      size="xs"
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={presentation.label}
      title={stateDescription({ presentation })}
      className="shrink-0"
      testId="artifact-state-chip"
    />
  );
};
