import { RotateCcw, Square } from 'lucide-react';
import {
  GhostActionButton,
  InteractiveRow,
  WORK_META_COLUMN,
  WORK_NODE_GLYPH_SIZE,
  WORK_ROW,
  WorkNode,
  cn,
  tintClasses,
} from '@goodboy/ui';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../artifactPresentation';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ArtifactKindGlyph } from './ArtifactKindGlyph';

type Props = {
  readonly row: Row;
  readonly onOpen: () => void;
  readonly onStop: () => void;
  readonly onRetry: () => void;
};

const SENTENCE_CLASS = {
  warning: tintClasses('warning').text,
  info: tintClasses('info').text,
  danger: tintClasses('danger').text,
  neutral: 'text-muted-foreground',
} as const satisfies Record<Row['sentenceTone'], string>;

export const ArtifactListRow = ({ row, onOpen, onStop, onRetry }: Props) => (
  <InteractiveRow
    label={`${ARTIFACT_KIND_MARKER_LABEL[row.kind]} ${row.title}, ${row.sentence}`}
    isSelected={false}
    onOpen={onOpen}
    dataAttributes={{ 'data-artifact-row': row.key }}
    frameClassName={cn(WORK_ROW.container, 'group')}
    className="flex min-h-9 min-w-0 items-center gap-2.5 px-2 py-1.5"
  >
    <WorkNode
      state={row.node}
      label={row.sentence}
      mark={
        row.node === 'marker'
          ? {
              kind: 'glyph',
              glyph: <ArtifactKindGlyph kind={row.kind} size={WORK_NODE_GLYPH_SIZE} />,
            }
          : { kind: 'dot' }
      }
    />
    <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
      <span
        className={cn(
          WORK_ROW.title,
          'max-w-[60%] shrink-0 truncate text-sm leading-5',
          row.isFaint ? 'text-faint-foreground' : 'text-foreground',
        )}
        title={row.title}
      >
        {row.title}
      </span>
      <span
        className={cn(
          WORK_ROW.state,
          'min-w-0 truncate text-xs leading-4',
          row.isFaint ? 'text-faint-foreground' : SENTENCE_CLASS[row.sentenceTone],
        )}
      >
        {row.sentence}
      </span>
    </span>
    <span
      data-testid="artifact-row-meta"
      className="flex shrink-0 items-center gap-3 text-2xs leading-4 tabular-nums text-muted-foreground"
    >
      <span className="flex w-20 shrink-0 items-center gap-1.5 truncate @max-[520px]:hidden">
        <ArtifactKindGlyph kind={row.kind} size={ICON_SIZE.row} />
        {ARTIFACT_KIND_MARKER_LABEL[row.kind]}
      </span>
      <span className="w-24 shrink-0 truncate @max-[640px]:hidden">{row.author ?? ''}</span>
      <span className="w-10 shrink-0 truncate text-faint-foreground @max-[440px]:hidden">
        {row.revision === null ? '' : `rev ${row.revision}`}
      </span>
      <span className={WORK_META_COLUMN.time}>
        {row.at === null ? '' : formatCompactDateTime({ iso: row.at })}
      </span>
    </span>
    <span className={WORK_META_COLUMN.action}>
      {row.action === 'stop' ? (
        <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <GhostActionButton icon={Square} label="Stop" onClick={onStop} />
        </span>
      ) : null}
      {row.action === 'retry' ? (
        <GhostActionButton icon={RotateCcw} label="Try again" onClick={onRetry} />
      ) : null}
    </span>
  </InteractiveRow>
);
