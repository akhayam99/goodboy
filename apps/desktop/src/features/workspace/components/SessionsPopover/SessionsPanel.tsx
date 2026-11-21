import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { EmptyLine, ICON_SIZE, Kbd, PopoverPin, SearchField, SelectableRow } from '@goodboy/ui';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  sessionPlace,
  useAppStore,
  useProjectMountsForSessions,
  useSessionOrder,
  useSessions,
} from '../../../../store';
import { PINNED_GROUP_KEY } from '../../../../store/slices/session-view/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { openDestination } from '../../../../shared/navigation/openDestination';
import { stageWord } from '../SessionHoverCard/stageWord';
import { projectLineOf } from '../StageBoard/projectLineOf';
import { SessionsGroup } from './SessionsGroup';
import { sessionOptionId } from './sessionOptionId';
import { sessionsShownOf, type ShownGroup } from './sessionsShownOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type GroupParams = {
  readonly group: ShownGroup;
};

type MoveParams = {
  readonly delta: number;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLInputElement>;
};

const groupWordOf = ({ group }: GroupParams): string =>
  group.key === PINNED_GROUP_KEY ? 'Pinned' : stageWord({ stage: group.key });

const BoardIcon = CONCEPT_ICONS.sessions;

export const SessionsPanel = ({ workspaceId, onClose }: Props) => {
  const sessions = useSessions();
  const isLoaded = useAppStore((s) => s.boardReady && s.switchingToWorkspaceId == null);
  const navigate = useAppStore((s) => s.navigate);
  const pinSession = useAppStore((s) => s.pinSession);
  const unpinSession = useAppStore((s) => s.unpinSession);
  const { groups } = useSessionOrder({ workspaceId, sessions });
  const mounts = useProjectMountsForSessions({ sessions });
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const projectOf = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(mounts).map(([id, sessionMounts]) => [
          id,
          projectLineOf({ mounts: sessionMounts }),
        ]),
      ),
    [mounts],
  );
  const shown = useMemo(
    () => sessionsShownOf({ groups, query, projectOf }),
    [groups, query, projectOf],
  );
  const pinnedIds = useMemo(
    () =>
      new Set<string>(
        groups
          .filter((group) => group.key === PINNED_GROUP_KEY)
          .flatMap((group) => group.sessions.map((session) => session.id)),
      ),
    [groups],
  );
  const flat = shown.flatMap((group) => group.sessions);
  const active = Math.min(activeIndex, Math.max(flat.length - 1, 0));
  const offsets = shown.map((_, index) =>
    shown.slice(0, index).reduce((sum, group) => sum + group.sessions.length, 0),
  );

  const open = ({ sessionId }: SessionParams) => {
    onClose();
    navigate({ to: sessionPlace({ sessionId }) });
  };

  const togglePin = ({ sessionId }: SessionParams) => {
    if (pinnedIds.has(sessionId)) {
      void unpinSession(sessionId);
      return;
    }
    void pinSession(sessionId);
  };

  const move = ({ delta }: MoveParams) => {
    if (flat.length === 0) {
      return;
    }
    const next = Math.max(0, Math.min(flat.length - 1, active + delta));
    setActiveIndex(next);
    document
      .getElementById(sessionOptionId({ listId, index: next }))
      ?.scrollIntoView({ block: 'nearest' });
  };

  const handleKey = ({ event }: KeyParams) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move({ delta: event.key === 'ArrowDown' ? 1 : -1 });
      return;
    }
    const target = flat[active];
    if (event.key !== 'Enter' || target === undefined) {
      return;
    }
    event.preventDefault();
    open({ sessionId: brandId<SessionId>({ value: target.id }) });
  };

  const emptyLine =
    query.trim() === ''
      ? 'No live sessions here. Finished ones stay on the Board.'
      : `No session matches ${query.trim()}`;

  return (
    <>
      <PopoverPin edge="start" className="p-2">
        <SearchField
          autoFocus
          size="md"
          ariaLabel={NAMES.searchSessions}
          placeholder={NAMES.searchSessions}
          value={query}
          onChange={(next) => {
            setQuery(next);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => handleKey({ event })}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            flat.length === 0 ? undefined : sessionOptionId({ listId, index: active })
          }
          hint={<Kbd>{shortcutGlyphs('sessions.toggle')}</Kbd>}
        />
      </PopoverPin>
      <div className="flex flex-col pb-1">
        {isLoaded && flat.length === 0 ? (
          <EmptyLine className="px-3 py-2">{emptyLine}</EmptyLine>
        ) : (
          <div id={listId} role="listbox" aria-label="Sessions" className="flex flex-col">
            {shown.map((group, index) => (
              <SessionsGroup
                key={group.key}
                label={groupWordOf({ group })}
                count={group.count}
                sessions={group.sessions}
                offset={offsets[index] ?? 0}
                activeIndex={active}
                listId={listId}
                projectOf={projectOf}
                pinnedIds={pinnedIds}
                onOpen={(sessionId) => open({ sessionId })}
                onTogglePin={(sessionId) => togglePin({ sessionId })}
              />
            ))}
          </div>
        )}
      </div>
      <PopoverPin edge="end" className="p-1">
        <SelectableRow
          selected={false}
          onClick={() => {
            onClose();
            openDestination({ id: 'board' });
          }}
          className="h-8 items-center gap-2 px-2 text-ui"
        >
          <BoardIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="flex-1">Open {NAMES.board}</span>
          <Kbd>{shortcutGlyphs('session.board')}</Kbd>
        </SelectableRow>
      </PopoverPin>
    </>
  );
};
