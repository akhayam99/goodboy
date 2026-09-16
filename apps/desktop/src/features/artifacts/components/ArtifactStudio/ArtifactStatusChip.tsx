import { Chip } from '@goodboy/ui';
import type { ArtifactKind, ArtifactStatus } from '@goodboy/types';
import { describeArtifactStatus } from '../../artifact-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly kind: ArtifactKind;
  readonly status: ArtifactStatus;
};

export const ArtifactStatusChip = ({ kind, status }: Props) => {
  const presentation = describeArtifactStatus({ kind, status });

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
    />
  );
};
