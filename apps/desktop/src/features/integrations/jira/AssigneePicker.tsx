import { useMemo, useState } from 'react';
import { Check, UserRound } from 'lucide-react';
import {
  Button,
  cn,
  Divider,
  DropdownBackdrop,
  formatError,
  Input,
  Popover,
  ScrollFade,
  StatusDot,
  useDropdown,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { JiraUser } from './client';
import { useJiraAssignableUsers } from './useJiraAssignableUsers';

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

const MENU_ROW =
  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50';

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
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
  } = useDropdown({ align: 'end', width: 'w-64', expectedHeight: 300, hasBackdrop: true });
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

  return (
    <div ref={containerRef} className="relative">
      <Button
        size="sm"
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Change who owns this issue in Jira"
        isBusy={busyId != null}
        busyLabel="Assigning"
        onClick={toggle}
      >
        <UserRound size={12} aria-hidden />
        {assignee?.displayName ?? 'Unassigned'}
      </Button>
      {isOpen && (
        <>
          <DropdownBackdrop onClose={close} />
          <Popover
            innerRef={popupRef}
            role="menu"
            ariaLabel="Assign this issue"
            className={cn(popupClassName, 'flex flex-col')}
          >
            <div className="p-1">
              <Input
                autoFocus
                value={query}
                aria-label="Filter assignable people"
                placeholder="Filter by name"
                onChange={(event) => setQuery(event.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <Divider />
            <ScrollFade className="max-h-64" viewportClassName="flex flex-col gap-0.5 p-1">
              {assignee != null && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busyId != null}
                  onClick={() => void assign(null)}
                  className={MENU_ROW}
                >
                  <span className="min-w-0 truncate text-muted-foreground">Unassign</span>
                  {busyId === UNASSIGN_ROW_ID && <StatusDot tone="neutral" pulsing />}
                </button>
              )}
              {filtered.map((user) => (
                <button
                  key={user.accountId}
                  type="button"
                  role="menuitem"
                  disabled={busyId != null}
                  onClick={() => void assign(user.accountId)}
                  className={MENU_ROW}
                >
                  <span className="min-w-0 truncate">{user.displayName}</span>
                  {busyId === user.accountId && <StatusDot tone="neutral" pulsing />}
                  {busyId !== user.accountId && user.accountId === assignee?.accountId && (
                    <Check size={12} aria-hidden />
                  )}
                </button>
              ))}
              {isLoading && (
                <p role="status" className="px-2 py-1.5 text-2xs text-muted-foreground">
                  Reading who can take this issue
                </p>
              )}
              {!isLoading && error == null && filtered.length === 0 && (
                <p className="px-2 py-1.5 text-2xs text-muted-foreground">
                  No one matches that name
                </p>
              )}
            </ScrollFade>
            {error != null && (
              <>
                <Divider />
                <div className="flex items-center justify-between gap-2 p-1">
                  <p role="alert" className="min-w-0 text-2xs text-danger">
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
                <p role="alert" className="px-2 py-1.5 text-2xs text-danger">
                  {assignError}
                </p>
              </>
            )}
          </Popover>
        </>
      )}
    </div>
  );
};
