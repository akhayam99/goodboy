import { memo, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn, ICON_SIZE, InteractiveRow, Tooltip, TruncatedText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { RelativeTime } from '../../../../shared/components/RelativeTime';

import { ArtifactKindGlyph } from './ArtifactKindGlyph';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactRowActions } from './ArtifactRowActions';
import { ArtifactRowConfirm } from './ArtifactRowConfirm';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';
import { ArtifactRowParts } from './ArtifactRowParts';
import { ArtifactStateBadge } from './ArtifactStateBadge';
import { useArtifactRowModel } from './useArtifactRowModel';

type Props = {
  readonly row: Row;
  readonly rowKey?: string;
  readonly isStateShown?: boolean;
  readonly titleSuffix?: ReactNode;
  readonly sessionId: SessionId;
  readonly isPartsOpen: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
  readonly hasActionColumn: boolean;
};

const RowComponent = ({
  row,
  rowKey = row.id,
  isStateShown = false,
  titleSuffix,
  sessionId,
  isPartsOpen,
  onTogglePartsOf,
  onOpenRow,
  hasActionColumn,
}: Props) => {
  const model = useArtifactRowModel({ row, rowKey, sessionId, isStateShown });
  const { menu, controls, hasParts, state, at, atTitle } = model;

  const title = (
    <TruncatedText
      isFocusable
      className={cn(
        titleSuffix === undefined ? ARTIFACT_ROW_GRID.title : 'min-w-0 truncate text-row',
        row.isFaint ? 'text-faint-foreground' : 'text-foreground',
      )}
    >
      {row.title}
    </TruncatedText>
  );

  return (
    <div className="@container relative flex min-w-0 flex-col" data-testid="artifact-row-frame">
      <InteractiveRow
        menu={menu}
        label={model.label}
        isSelected={false}
        onOpen={() => onOpenRow({ row, rowKey })}
        dataAttributes={{ 'data-artifact-row': rowKey }}
        frameClassName="group"
        className={ARTIFACT_ROW_GRID.frame}
      >
        {hasParts ? (
          <Tooltip content="Parts">
            <button
              type="button"
              aria-expanded={isPartsOpen}
              aria-label={`${isPartsOpen ? 'Hide' : 'Show'} parts of ${row.title}`}
              onClick={() => onTogglePartsOf(rowKey)}
              className={cn(
                ARTIFACT_ROW_GRID.lead,
                'grid place-items-center rounded-sm text-faint-foreground hover:bg-hover hover:text-foreground',
              )}
            >
              <ChevronRight
                size={ICON_SIZE.control}
                aria-hidden
                className={cn('motion-safe:transition-transform', isPartsOpen && 'rotate-90')}
              />
            </button>
          </Tooltip>
        ) : (
          <span aria-hidden className={ARTIFACT_ROW_GRID.lead} />
        )}
        <ArtifactKindGlyph
          kind={row.kind}
          size={ICON_SIZE.control}
          className={cn(ARTIFACT_ROW_GRID.glyph, row.isFaint && 'text-faint-foreground')}
        />
        {titleSuffix === undefined ? (
          title
        ) : (
          <span className="flex min-w-16 flex-1 items-center gap-2">
            {title}
            {titleSuffix}
          </span>
        )}
        <span className={cn(ARTIFACT_ROW_GRID.state, row.isFaint && 'opacity-80')}>
          {state === null ? null : <ArtifactStateBadge state={state} />}
        </span>
        <span data-testid="artifact-row-time" className={ARTIFACT_ROW_GRID.date}>
          {at === null ? null : <RelativeTime iso={at} title={atTitle} />}
        </span>
        {hasActionColumn ? (
          <span data-testid="artifact-row-action" className={ARTIFACT_ROW_GRID.action}>
            <ArtifactRowActions model={model} />
          </span>
        ) : null}
      </InteractiveRow>
      <ArtifactRowConfirm controls={controls} />
      {controls.failure === null ? null : (
        <p role="alert" className="px-8 pb-1 text-meta text-danger">
          {controls.failure.message}
        </p>
      )}
      {hasParts && isPartsOpen ? (
        <ArtifactRowParts parts={row.parts} hasActionColumn={hasActionColumn} />
      ) : null}
    </div>
  );
};

export const ArtifactListRow = memo(RowComponent);
