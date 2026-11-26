import { ChevronRight } from '@goodboy/ui/icons';
import { Button, CountBadge, ICON_SIZE, SelectableRow, TruncatedText, cn } from '@goodboy/ui';
import type { ErrorFrame, ErrorGroup } from '../../errorGroupsOf';
import { errorMetaOf } from '../../errorMetaOf';
import { ErrorsFrame } from './ErrorsFrame';

type FrameParams = {
  readonly frame: ErrorFrame;
};

type Props = {
  readonly group: ErrorGroup;
  readonly isOpen: boolean;
  readonly sendLabel: string;
  readonly canSend: boolean;
  readonly fileOf: (params: FrameParams) => string | null;
  readonly onToggle: () => void;
  readonly onSend: () => void;
};

export const ErrorsGroup = ({
  group,
  isOpen,
  sendLabel,
  canSend,
  fileOf,
  onToggle,
  onSend,
}: Props) => {
  const top = group.frames[0];
  const place = top === undefined ? group.source : (fileOf({ frame: top }) ?? top.label);
  const response = group.request?.network?.responseBody ?? null;
  return (
    <div
      data-error-group={group.origin}
      className="flex min-w-0 flex-col rounded-sm hover:bg-hover"
    >
      <div className="flex min-w-0 items-center gap-1 pr-1">
        <SelectableRow
          selected={false}
          isExpanded={isOpen}
          ariaLabel={`Error: ${group.text}`}
          onClick={onToggle}
          className="min-w-0 flex-1 items-center gap-2 px-2 py-0.5 text-code"
        >
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'shrink-0 text-danger motion-safe:transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <TruncatedText className="min-w-0 text-foreground">{group.text}</TruncatedText>
            <CountBadge
              count={group.count > 1 ? group.count : 0}
              tone="danger"
              label={`${group.count} times`}
            />
          </span>
          {place === null ? null : (
            <TruncatedText className="max-w-[40%] shrink-0 text-faint-foreground">
              {place}
            </TruncatedText>
          )}
        </SelectableRow>
        <Button
          variant="quiet"
          size="xs"
          aria-label={sendLabel}
          disabled={!canSend}
          onClick={onSend}
          className="shrink-0"
        >
          Send
        </Button>
      </div>
      {isOpen ? (
        <div role="group" aria-label="Stack" className="flex min-w-0 flex-col gap-1 pb-2 pl-8 pr-3">
          <div className="flex min-w-0 flex-col gap-px text-code">
            {group.frames.map((frame, index) => (
              <ErrorsFrame
                key={`${index}-${frame.url}-${frame.line}`}
                frame={frame}
                file={fileOf({ frame })}
              />
            ))}
            {response === null || response.trim() === '' ? null : (
              <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
                <span className="shrink-0">response</span>
                <TruncatedText className="min-w-0 flex-1 text-right text-faint-foreground">
                  {response}
                </TruncatedText>
              </div>
            )}
          </div>
          <p className="text-meta text-muted-foreground">{errorMetaOf({ group })}</p>
        </div>
      ) : null}
    </div>
  );
};
