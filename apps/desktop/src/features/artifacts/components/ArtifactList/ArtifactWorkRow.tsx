import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Button,
  cn,
  ICON_SIZE,
  ListGridRow,
  StatusDot,
  TruncatedText,
  WorkNode,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { countNoun } from '../../../../shared/utils/countNoun';
import { ArtifactKindGlyph } from './ArtifactKindGlyph';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactRowActions } from './ArtifactRowActions';
import { ArtifactRowConfirm } from './ArtifactRowConfirm';
import { useArtifactRowModel } from './useArtifactRowModel';

type Props = {
  readonly row: Row;
  readonly rowKey: string;
  readonly titleSuffix: ReactNode;
  readonly sessionId: SessionId;
  readonly isPartsOpen: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
};

const SPAN_ROW = 'col-span-full grid grid-cols-subgrid';

const SPAN_CELL = 'col-start-2 col-end-[-2] min-w-0';

const CONFIRM_ANCHOR = 'absolute right-0 top-0 size-0';

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

export const ArtifactWorkRow = ({
  row,
  rowKey,
  titleSuffix,
  sessionId,
  isPartsOpen,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const model = useArtifactRowModel({ row, rowKey, sessionId, isStateShown: true });
  const { menu, controls, hasParts, state, at, atTitle } = model;
  const hasActions = model.restoreAction !== null || model.primary !== null;
  const open = () => onOpenRow({ row, rowKey });
  const title = (
    <span
      data-artifact-row-title=""
      className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2"
      onClick={(event) => openFromTitle({ event, onOpen: open })}
    >
      <TruncatedText
        className={cn('min-w-0', row.isFaint ? 'text-faint-foreground' : 'text-foreground')}
      >
        {row.title}
      </TruncatedText>
      {hasParts ? (
        <Button
          variant="quiet"
          size="xs"
          aria-expanded={isPartsOpen}
          aria-label={`${isPartsOpen ? 'Hide' : 'Show'} parts of ${row.title}`}
          onClick={() => onTogglePartsOf(rowKey)}
        >
          {countNoun({ count: row.partCount, one: 'part' })}
          <ChevronRight
            size={ICON_SIZE.control}
            aria-hidden
            className={cn('motion-safe:transition-transform', isPartsOpen && 'rotate-90')}
          />
        </Button>
      ) : null}
      {titleSuffix}
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
            state: state === null ? null : <StatusDot size="sm" tone={state.tone} />,
            shape: (
              <ArtifactKindGlyph
                kind={row.kind}
                size={ICON_SIZE.row}
                className={row.isFaint ? 'text-faint-foreground' : 'text-muted-foreground'}
              />
            ),
            title: '',
            word: state === null ? null : state.label,
            age: at === null ? null : <RelativeTime iso={at} title={atTitle} />,
            verb: hasActions ? <span aria-hidden /> : null,
          },
        }}
      />
      {controls.confirming === null ? null : (
        <li className={SPAN_ROW}>
          <div className={cn(SPAN_CELL, 'relative')}>
            <ArtifactRowConfirm controls={controls} anchorClassName={CONFIRM_ANCHOR} />
          </div>
        </li>
      )}
      {controls.failure === null ? null : (
        <li className={SPAN_ROW}>
          <p role="alert" className={cn(SPAN_CELL, 'text-meta text-danger')}>
            {controls.failure.message}
          </p>
        </li>
      )}
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
