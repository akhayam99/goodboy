import { memo, type MouseEvent, type ReactNode } from 'react';
import { ChevronRight } from '@goodboy/ui/icons';
import {
  Button,
  cn,
  FactCard,
  ICON_SIZE,
  ListGridRow,
  StateDot,
  Tooltip,
  TruncatedText,
  WorkNode,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../../artifactListRows';
import { RelativeTime } from '../../../../../shared/components/RelativeTime';
import { countNoun } from '../../../../../shared/utils/countNoun';
import { artifactDotOf } from '../../../artifactDotOf';
import { artifactStateCardOf } from '../../../artifactStateCardOf';
import { ArtifactKindGlyph } from '../ArtifactKindGlyph';
import type { ArtifactOpenParams } from '../artifactBranchProps';
import { ArtifactRowActions } from '../ArtifactRowActions';
import { ArtifactRowConfirm } from '../ArtifactRowConfirm';
import { useArtifactRowFailure } from '../useArtifactRowFailure';
import { useArtifactRowModel } from '../useArtifactRowModel';

type Props = {
  readonly row: Row;
  readonly rowKey: string;
  readonly titleSuffix?: ReactNode;
  readonly sessionId: SessionId;
  readonly isPartsOpen: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
};

const CONFIRM_ANCHOR = 'absolute right-0 top-8 size-0';

type TitleClickParams = {
  readonly event: MouseEvent<HTMLElement>;
  readonly onOpen: () => void;
};

const openFromTitle = ({ event, onOpen }: TitleClickParams): void => {
  if (event.target instanceof Element && event.target.closest('button, a') !== null) {
    return;
  }
  onOpen();
};

const RowComponent = ({
  row,
  rowKey,
  titleSuffix,
  sessionId,
  isPartsOpen,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const model = useArtifactRowModel({ row, rowKey, sessionId });
  useArtifactRowFailure({
    failure: model.controls.failure,
    retry: model.controls.retry,
    dismissFailure: model.controls.dismissFailure,
    title: row.title,
    sessionId,
  });
  const { menu, controls, hasParts, state, at, atTitle } = model;
  const hasActions = model.restoreAction !== null || model.primary !== null;
  const open = () => onOpenRow({ row, rowKey });
  const title = (
    <span
      data-artifact-row-title=""
      className="relative flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2"
      onClick={(event) => openFromTitle({ event, onOpen: open })}
    >
      {hasParts ? (
        <Tooltip content="Parts">
          <Button
            variant="quiet"
            size="xs"
            aria-expanded={isPartsOpen}
            aria-label={`${isPartsOpen ? 'Hide' : 'Show'} parts of ${row.title}`}
            onClick={() => onTogglePartsOf(rowKey)}
          >
            <ChevronRight
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('motion-safe:transition-transform', isPartsOpen && 'rotate-90')}
            />
          </Button>
        </Tooltip>
      ) : null}
      <TruncatedText
        className={cn('min-w-0', row.isFaint ? 'text-faint-foreground' : 'text-foreground')}
      >
        {row.title}
      </TruncatedText>
      {hasParts ? (
        <span className="shrink-0 text-meta text-faint-foreground">
          {countNoun({ count: row.partCount, one: 'part' })}
        </span>
      ) : null}
      {titleSuffix}
      <ArtifactRowConfirm controls={controls} anchorClassName={CONFIRM_ANCHOR} />
    </span>
  );
  return (
    <>
      <ListGridRow
        ariaLabel={model.label}
        rowKey={rowKey}
        onSelect={open}
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        overlays={[
          { column: 'title', node: title },
          { column: 'verb', node: hasActions ? <ArtifactRowActions model={model} /> : null },
        ]}
        cells={{
          byKey: {
            state:
              state === null ? null : (
                <StateDot
                  state={artifactDotOf({ state })}
                  label={state.label}
                  isLive={artifactDotOf({ state }) === 'running'}
                />
              ),
            shape: (
              <ArtifactKindGlyph
                kind={row.kind}
                size={ICON_SIZE.row}
                className={row.isFaint ? 'text-faint-foreground' : 'text-muted-foreground'}
              />
            ),
            title: '',
            word:
              state === null ? null : (
                <FactCard card={artifactStateCardOf({ state })}>
                  <span
                    data-testid="artifact-row-state"
                    data-state={state.key}
                    className="truncate"
                  >
                    {state.label}
                  </span>
                </FactCard>
              ),
            age: at === null ? null : <RelativeTime iso={at} title={atTitle} />,
            verb: hasActions ? <span aria-hidden /> : null,
          },
        }}
      />
      {hasParts && isPartsOpen
        ? row.parts.map((part) => (
            <ListGridRow
              key={part.index}
              rowHeight={28}
              cells={{
                byKey: {
                  shape: (
                    <WorkNode
                      state={part.nodeState}
                      size="sm"
                      mark={{ kind: 'index', value: String(part.index + 1) }}
                      label={part.nodeLabel}
                    />
                  ),
                  title: (
                    <TruncatedText className="min-w-0 text-muted-foreground">
                      {part.title}
                    </TruncatedText>
                  ),
                  word: part.nodeLabel,
                },
              }}
            />
          ))
        : null}
    </>
  );
};

export const ArtifactWorkRow = memo(RowComponent);
