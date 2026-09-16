import { Chip } from '@goodboy/ui';
import type { ArtifactStatus } from '@goodboy/types';
import { describeArtifactStatus } from '../../artifact-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly status: ArtifactStatus;
};

export const ArtifactStatusChip = ({ status }: Props) => {
  const presentation = describeArtifactStatus({ status });
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
    />
  );
};
