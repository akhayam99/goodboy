import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'artifact_block' }>;
};

export const ArtifactBlockCard = ({ item }: Props) => (
  <TranscriptDisclosure
    tone="neutral"
    open={false}
    header={
      <TranscriptRowHeader
        grouped
        tone="neutral"
        icon={<CONCEPT_ICONS.artifacts size={ICON_SIZE.row} aria-hidden />}
        eyebrow="artifact"
        data-testid="artifact-block-row"
        preview={
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">
              {item.complete
                ? `${item.artifactKind} captured`
                : `${item.artifactKind} still arriving`}
            </span>
            {item.title !== null ? (
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {item.title}
              </span>
            ) : null}
          </span>
        }
      />
    }
  />
);
