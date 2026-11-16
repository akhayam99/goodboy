import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import {
  AnchoredPopover,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  ScrollFade,
  useDropdown,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';
import type { InboxProvider, InboxRecord } from '../../../../inbox/types';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';
import { TaskPickerList } from './TaskPickerList';
import { TaskPickerNotice } from './TaskPickerNotice';
import { taskPickerOptionId } from './taskPickerOptionId';
import { taskPickerSourcePref } from './taskPickerSourcePref';
import { TaskPickerSources } from './TaskPickerSources';
import { TaskPickerTrigger } from './TaskPickerTrigger';
import { taskPickerView, type TaskPickerItem, type TaskPickerSource } from './taskPickerView';
import { useTaskPickerCursor } from './useTaskPickerCursor';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly loading: Readonly<Record<InboxProvider, boolean>>;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly isDisabled: boolean;
  readonly onRetry: () => void;
  readonly onPick: (candidate: IssueCandidate) => void;
};

type SourceParams = {
  readonly next: TaskPickerSource;
};

type PickParams = {
  readonly item: TaskPickerItem;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

const PAGE = 8;

const STEP: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowUp: -1,
  PageDown: PAGE,
  PageUp: -PAGE,
};

export const TaskPickerPopover = ({
  workspaceId,
  records,
  connected,
  loading,
  errors,
  isDisabled,
  onRetry,
  onPick,
}: Props) => {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<TaskPickerSource>(() =>
    taskPickerSourcePref({ workspaceId }).read(),
  );
  const dropdown = useDropdown({
    disabled: isDisabled,
    width: POPOVER_WIDTH_CLASS.studio,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    expectedHeight: 440,
  });
  const isOpen = dropdown.open;
  const view = useMemo(
    () => taskPickerView({ records, connected, source, query }),
    [records, connected, source, query],
  );
  const keys = useMemo(() => view.items.map((item) => item.key), [view.items]);
  const cursor = useTaskPickerCursor({ keys });
  const { setActiveKey } = cursor;
  const activeId =
    isOpen && cursor.activeKey !== null
      ? taskPickerOptionId({ listId, key: cursor.activeKey })
      : undefined;
  const hasSources = view.sources.length > 1;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveKey(null);
      return;
    }
    searchRef.current?.focus();
  }, [isOpen, setActiveKey]);

  useEffect(() => {
    const element = activeId === undefined ? null : document.getElementById(activeId);
    if (element !== null && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  const changeSource = ({ next }: SourceParams): void => {
    setSource(next);
    setActiveKey(null);
    taskPickerSourcePref({ workspaceId }).write(next);
  };

  const pick = ({ item }: PickParams): void => {
    onPick(item.candidate);
    dropdown.close();
  };

  const onSearchKey = ({ event }: KeyParams): void => {
    const step = STEP[event.key];
    if (step !== undefined) {
      event.preventDefault();
      cursor.move({ delta: step });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = view.items.find((candidate) => candidate.key === cursor.activeKey);
      if (item !== undefined) {
        pick({ item });
      }
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    if (!hasSources) {
      dropdown.close();
      return;
    }
    event.preventDefault();
    sourcesRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  };

  const onSourcesKey = ({ event }: KeyParams): void => {
    if (event.key !== 'Tab' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    searchRef.current?.focus();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={START_KIND_COPY.pickTask}
      anchorClassName="inline-flex max-w-full"
      className="origin-top motion-safe:animate-popover-in"
      trigger={
        <TaskPickerTrigger
          isOpen={isOpen}
          isDisabled={isDisabled}
          listId={listId}
          buttonRef={triggerRef}
          onToggle={dropdown.toggle}
        />
      }
    >
      <div className="flex max-h-112 min-h-0 min-w-0 flex-col">
        <div ref={sourcesRef} className="flex shrink-0 flex-col">
          <div className="flex h-10 items-center gap-2 px-3 text-muted-foreground">
            <Search size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={START_KIND_COPY.searchTasks}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder={START_KIND_COPY.searchTasks}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveKey(null);
              }}
              onKeyDown={(event) => onSearchKey({ event })}
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none focus-visible:outline-none! placeholder:text-faint-foreground"
            />
          </div>
          {hasSources ? (
            <TaskPickerSources
              view={view}
              loading={loading}
              errors={errors}
              onChange={(next) => changeSource({ next })}
              onKeyDown={(event) => onSourcesKey({ event })}
            />
          ) : null}
        </div>
        <ScrollFade
          className="flex min-h-0 flex-1 flex-col"
          viewportClassName="h-auto min-h-0 flex-1 p-1"
          fadeFrom="floating"
          fadeSize={12}
        >
          <div className="flex flex-col">
            <TaskPickerNotice
              view={view}
              query={query}
              loading={loading}
              errors={errors}
              onRetry={onRetry}
            />
            <TaskPickerList
              listId={listId}
              view={view}
              activeKey={cursor.activeKey}
              onActivate={setActiveKey}
              onPick={(item) => pick({ item })}
            />
          </div>
        </ScrollFade>
      </div>
    </AnchoredPopover>
  );
};
