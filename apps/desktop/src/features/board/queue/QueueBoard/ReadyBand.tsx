import {
  Button,
  InteractiveRow,
  SectionLabel,
  SelectionCheckbox,
  Tooltip,
  TruncatedText,
} from '@goodboy/ui';
import type { MergeTrain } from '../../../../store/slices/pr-series/mergeTrain';
import { NAMES } from '../../../../shared/utils/names';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { PrMergeMethod } from '@goodboy/types';
import { mergeHintOf } from '../mergeHintOf';
import { mergeLabelOf } from '../mergeLabelOf';
import type { ReadyLine } from '../readyLinesOf';
import { TrainStrip } from './TrainStrip';

type RowParams = {
  readonly sessionId: string;
};

type Props = {
  readonly lines: ReadonlyArray<ReadyLine>;
  readonly focusedId: string | null;
  readonly isActive: boolean;
  readonly marked: ReadonlySet<string>;
  readonly train: MergeTrain | null;
  readonly method: PrMergeMethod;
  readonly onOpen: (params: RowParams) => void;
  readonly onToggleMark: (params: RowParams) => void;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onDismiss: () => void;
};

export const ReadyBand = ({
  lines,
  focusedId,
  isActive,
  marked,
  train,
  method,
  onOpen,
  onToggleMark,
  onStart,
  onStop,
  onDismiss,
}: Props) => {
  const count = lines.filter((line) => line.car !== null && marked.has(line.sessionId)).length;
  const label = mergeLabelOf({ count });
  const look = actionButtonLookOf({ verb: label, variant: 'secondary' });
  return (
    <section
      aria-label={NAMES.readyToMerge}
      data-queue-band="ready"
      data-band-active={isActive ? '' : undefined}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-2 outline-none"
    >
      {train === null ? (
        <div className="flex min-h-8 min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <SectionLabel label={NAMES.readyToMerge} headingLevel={2} />
          </div>
          {lines.length === 0 ? null : (
            <Tooltip content={mergeHintOf({ method })}>
              <Button
                size="xs"
                variant={look.variant}
                intent={look.intent}
                disabled={count === 0}
                data-merge-in-order=""
                onClick={onStart}
              >
                {label}
              </Button>
            </Tooltip>
          )}
        </div>
      ) : (
        <TrainStrip train={train} onStop={onStop} onDismiss={onDismiss} />
      )}
      {lines.length === 0 ? (
        <span className="text-ui text-muted-foreground">{NAMES.nothingToMerge}</span>
      ) : null}
      {lines.map((line) => {
        const isMarked = marked.has(line.sessionId);
        return (
          <InteractiveRow
            key={line.sessionId}
            label={line.title}
            isSelected={isActive && line.sessionId === focusedId}
            onOpen={() => onOpen({ sessionId: line.sessionId })}
            dataAttributes={{ 'data-ready-row': line.sessionId }}
            className="flex min-h-8 min-w-0 items-start gap-3 px-3 py-1"
          >
            <SelectionCheckbox
              checked={isMarked}
              label={line.number === null ? line.title : `#${line.number}`}
              disabled={line.car === null || train !== null}
              isAlwaysShown
              onToggle={() => onToggleMark({ sessionId: line.sessionId })}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                {line.number === null ? null : (
                  <span className="shrink-0 text-ui tabular-nums text-foreground">{`#${line.number}`}</span>
                )}
                {line.car === null ? null : (
                  <span className="shrink-0 text-ui text-foreground">{line.car.repo}</span>
                )}
                <TruncatedText className="min-w-0 flex-1 text-meta text-muted-foreground">
                  {line.title}
                </TruncatedText>
              </span>
              {line.reason === null ? null : (
                <span className="min-w-0 text-meta text-muted-foreground" data-ready-reason="">
                  {line.reason}
                </span>
              )}
            </span>
          </InteractiveRow>
        );
      })}
    </section>
  );
};
