import { Chip, MetaRow, RailCard } from '@goodboy/ui';
import {
  ARTIFACT_GENERATION_PRESENTATION,
  type ArtifactGeneration,
} from '../../artifactCollection';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';

type Props = {
  readonly generation: ArtifactGeneration;
  readonly onSelect: () => void;
};

export const ArtifactGenerationRow = ({ generation, onSelect }: Props) => {
  const presentation = ARTIFACT_GENERATION_PRESENTATION[generation.kind][generation.state];
  const Icon = presentation.icon;

  return (
    <RailCard
      title={generation.title}
      muted={generation.state === 'unproduced'}
      status={
        <Chip
          tone={presentation.tone}
          size="xs"
          bordered={false}
          icon={<Icon size={ICON_SIZE.row} aria-hidden />}
          label={presentation.label}
          title={stateDescription({ presentation })}
          className="shrink-0"
        />
      }
      meta={
        generation.startedAt === null ? null : (
          <MetaRow
            items={[
              <span key="started" className="tabular-nums">
                {formatCompactDateTime({ iso: generation.startedAt })}
              </span>,
            ]}
          />
        )
      }
      onSelect={onSelect}
    />
  );
};
