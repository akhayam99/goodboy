import { RotateCcw, Square } from 'lucide-react';
import { Chip, GhostActionButton, MetaRow, RailCard } from '@goodboy/ui';
import {
  ARTIFACT_GENERATION_PRESENTATION,
  type ArtifactGeneration,
} from '../../artifactCollection';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PROVIDER_LABEL, modelLabel } from '../../../chat/utils/chat-constants';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { wireframeScoutLine } from '../../../wireframes/wireframeScoutProgress';

type Props = {
  readonly generation: ArtifactGeneration;
  readonly onSelect: () => void;
  readonly onStop: () => void;
  readonly onRetry: () => void;
};

const routingLabel = ({
  generation,
}: {
  readonly generation: ArtifactGeneration;
}): string | null => {
  if (generation.provider === null) {
    return null;
  }
  const provider = PROVIDER_LABEL[generation.provider];
  return generation.model === null ? provider : `${provider} · ${modelLabel(generation.model)}`;
};

export const ArtifactGenerationRow = ({ generation, onSelect, onStop, onRetry }: Props) => {
  const presentation = ARTIFACT_GENERATION_PRESENTATION[generation.kind][generation.state];
  const Icon = presentation.icon;
  const routing = routingLabel({ generation });
  const items = [
    generation.startedAt === null ? null : (
      <span key="started" className="tabular-nums">
        {formatCompactDateTime({ iso: generation.startedAt })}
      </span>
    ),
    routing === null ? null : <span key="routing">{routing}</span>,
  ];
  const hasMeta = items.some((item) => item !== null);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="group flex min-w-0 items-center gap-1.5">
        <RailCard
          title={generation.title}
          muted={generation.state === 'unproduced'}
          className="min-w-0 flex-1"
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
          meta={hasMeta ? <MetaRow items={items} /> : null}
          onSelect={onSelect}
        />
        {generation.state === 'generating' && generation.canStop ? (
          <span className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <GhostActionButton icon={Square} label="Stop" onClick={onStop} />
          </span>
        ) : null}
        {generation.state === 'unproduced' ? (
          <span className="shrink-0">
            <GhostActionButton icon={RotateCcw} label="Try again" onClick={onRetry} />
          </span>
        ) : null}
      </div>
      {generation.scouts.length === 0 ? null : (
        <ul data-testid="artifact-generation-scouts" className="flex min-w-0 flex-col gap-0.5 pl-3">
          {generation.scouts.map((scout) => (
            <li key={scout.agentId} className="truncate text-2xs text-muted-foreground">
              {wireframeScoutLine({ scout })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
