import { useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import {
  EmptyLine,
  AnchoredPopover,
  Button,
  cn,
  Divider,
  formatError,
  Input,
  ScrollFade,
  useDropdown,
  type MenuEntry,
  Tooltip,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { JiraUser } from './client';
import { useJiraAssignableUsers } from './useJiraAssignableUsers';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { AppMenuList } from '../../actions/AppMenuList';

type Props = {
  readonly issueKey: string;
  readonly workspaceId: WorkspaceId;
  readonly assignee: JiraUser | null;
  readonly onAssign: (accountId: string | null) => Promise<void>;
};

type FilterParams = {
  readonly users: ReadonlyArray<JiraUser>;
  readonly query: string;
};

const UNASSIGN_ROW_ID = 'unassign';

const filterAssignees = ({ users, query }: FilterParams): ReadonlyArray<JiraUser> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return users;
  }
  return users.filter((user) => user.displayName.toLowerCase().includes(needle));
};

export const AssigneePicker = ({ issueKey, workspaceId, assignee, onAssign }: Props) => {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const dropdown = useDropdown({ width: 'w-80', expectedHeight: 300 });
  const { open: isOpen, close, toggle } = dropdown;
  const { users, isLoading, error, reload } = useJiraAssignableUsers({
    issueKey,
    workspaceId,
    isEnabled: isOpen,
  });
  const filtered = useMemo(() => filterAssignees({ users, query }), [users, query]);

  const assign = async (accountId: string | null) => {
    setBusyId(accountId ?? UNASSIGN_ROW_ID);
    setAssignError(null);
    try {
      await onAssign(accountId);
      close();
      setQuery('');
    } catch (assignFailure: unknown) {
      setAssignError(formatError(assignFailure));
    } finally {
      setBusyId(null);
    }
  };

  const isBusy = busyId != null;
  const unassign: ReadonlyArray<MenuEntry> =
    assignee == null
      ? []
      : [
          {
            kind: 'item',
            key: UNASSIGN_ROW_ID,
            label: 'Unassign',
            isDisabled: isBusy,
            shouldStayOpen: true,
            onSelect: () => assign(null),
          },
        ];
  const people: ReadonlyArray<MenuEntry> =
    filtered.length === 0
      ? []
      : [
          {
            kind: 'radio',
            key: 'assignee',
            label: 'Assign to',
            choices: filtered.map((user) => ({
              id: user.accountId,
              label: user.displayName,
              isCurrent: user.accountId === assignee?.accountId,
            })),
            isDisabled: isBusy,
            shouldStayOpen: true,
            onSelect: (accountId) => assign(accountId),
          },
        ];
  const entries = [...unassign, ...people];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className="flex flex-col"
      hasBackdrop
      trigger={
        <Tooltip content="Change who owns this issue in Jira" isSuppressed={isOpen}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            disabled={isBusy}
            onClick={toggle}
            className="inline-flex items-center gap-1 rounded-sm text-meta text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
          >
            <UserRound size={ICON_SIZE.row} aria-hidden />
            <span className={cn(isBusy && 'text-shimmer')}>
              {assignee?.displayName ?? 'Unassigned'}
            </span>
          </button>
        </Tooltip>
      }
    >
      <div className="p-1">
        <Input
          autoFocus
          value={query}
          aria-label="Filter assignable people"
          placeholder="Filter by name"
          onChange={(event) => setQuery(event.target.value)}
          className="h-7 text-label"
        />
      </div>
      <Divider />
      <ScrollFade className="max-h-64" viewportClassName="flex flex-col">
        {entries.length === 0 ? null : (
          <AppMenuList
            label="Assign this issue"
            entries={entries}
            onClose={close}
            isAutoFocus={false}
          />
        )}
        {isLoading && (
          <p role="status" className="px-2 py-1 text-meta text-muted-foreground">
            Reading who can take this issue
          </p>
        )}
        {!isLoading && error == null && filtered.length === 0 && (
          <EmptyLine className="px-2 py-1 text-meta text-muted-foreground">
            No one matches that name
          </EmptyLine>
        )}
      </ScrollFade>
      {error != null && (
        <>
          <Divider />
          <div className="flex items-center justify-between gap-2 p-1">
            <p role="alert" className="min-w-0 text-meta text-danger">
              {error}
            </p>
            <Button size="sm" variant="ghost" onClick={reload}>
              Retry
            </Button>
          </div>
        </>
      )}
      {assignError != null && (
        <>
          <Divider />
          <p role="alert" className="px-2 py-1 text-meta text-danger">
            {assignError}
          </p>
        </>
      )}
    </AnchoredPopover>
  );
};
