import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { standaloneArtifacts } from '../../../artifacts/standaloneArtifacts';
import { useDestinationCounts } from '../../hooks/useDestinationCounts';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { VITAL_CHIP } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

type ChipProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly count: number;
  readonly tooltip: string;
  readonly onOpen: () => void;
};

const AttentionChip = ({ icon: Icon, label, count, tooltip, onOpen }: ChipProps) => (
  <Tooltip content={tooltip}>
    <button type="button" onClick={onOpen} className={VITAL_CHIP}>
      <Icon size={11} aria-hidden className="text-muted-foreground/80" />
      <span>{label}</span>
      <span className="font-mono tabular-nums text-foreground">{count}</span>
    </button>
  </Tooltip>
);

export const AttentionChips = ({ sessionId, onSelectLens }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const counts = useDestinationCounts({ sessionId });
  const artifactCount = standaloneArtifacts({ artifacts }).length;
  const reviewCount = counts.review ?? 0;
  const questionCount = counts.questions ?? 0;

  if (artifactCount === 0 && reviewCount === 0 && questionCount === 0) {
    return null;
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      {questionCount > 0 ? (
        <AttentionChip
          icon={CONCEPT_ICONS.questions}
          label="Questions"
          count={questionCount}
          tooltip="Open questions waiting on you"
          onOpen={() => onSelectLens('questions')}
        />
      ) : null}
      {reviewCount > 0 ? (
        <AttentionChip
          icon={CONCEPT_ICONS.review}
          label="Review"
          count={reviewCount}
          tooltip="Review comments waiting on you"
          onOpen={() => onSelectLens('review')}
        />
      ) : null}
      {artifactCount > 0 ? (
        <AttentionChip
          icon={CONCEPT_ICONS.artifacts}
          label="Artifacts"
          count={artifactCount}
          tooltip="Reports and wireframes this session wrote"
          onOpen={() => onSelectLens('plans')}
        />
      ) : null}
    </span>
  );
};
