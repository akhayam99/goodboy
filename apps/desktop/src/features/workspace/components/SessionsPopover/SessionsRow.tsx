import { Pin } from '@goodboy/ui/icons';
import { ICON_SIZE, SelectableRow, StatusMark, Tooltip, cn } from '@goodboy/ui';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { SessionRowTitle } from '../SessionRowTitle';
import { useSessionRowFacts } from '../../hooks/useSessionRowFacts';
import { useFleetPhrase } from '../../hooks/useFleetPhrase';

type Props = {
  readonly session: Session;
  readonly optionId: string;
  readonly project: string;
  readonly isActive: boolean;
  readonly isPinned: boolean;
  readonly onOpen: () => void;
  readonly onTogglePin: () => void;
};

export const SessionsRow = ({
  session,
  optionId,
  project,
  isActive,
  isPinned,
  onOpen,
  onTogglePin,
}: Props) => {
  const { node, mark, keys, title } = useSessionRowFacts({ session });
  const phrase = useFleetPhrase({ sessionId: brandId<SessionId>({ value: session.id }) });
  const pinLabel = isPinned ? NAMES.unpin : NAMES.pin;
  return (
    <SelectableRow
      id={optionId}
      role="option"
      selected={isActive}
      ariaSelected={isActive}
      tabIndex={-1}
      onClick={onOpen}
      className="h-8 items-center gap-3 px-3 text-ui"
    >
      <StatusMark mark={mark} {...(mark.kind !== 'empty' && { label: node.label })} />
      <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
      {phrase === null ? null : (
        <span
          data-fleet-phrase=""
          className="max-w-48 shrink-0 truncate text-meta text-muted-foreground"
        >
          {phrase}
        </span>
      )}
      {phrase !== null || project === '' ? null : (
        <span className="max-w-32 shrink-0 truncate text-meta text-faint-foreground">
          {project}
        </span>
      )}
      <Tooltip content={pinLabel} side="right">
        <span
          aria-hidden
          data-sessions-pin={isPinned ? 'on' : 'off'}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-hover hover:text-foreground',
            isPinned ? 'text-muted-foreground' : 'text-faint-foreground',
          )}
        >
          <Pin size={ICON_SIZE.row} aria-hidden />
        </span>
      </Tooltip>
    </SelectableRow>
  );
};
