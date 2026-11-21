import { useEffect, useState } from 'react';
import { UserRound, UserX } from '@goodboy/ui/icons';
import { ErrorStrip, formatError, SkeletonRow, type MenuEntry } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearFetchTeamMembers, type LinearTeamMember } from './client';
import { AppMenuList } from '../../actions/AppMenuList';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly issueId: string;
  readonly currentName: string | null;
  readonly onPick: (assigneeId: string | null) => void;
  readonly onClose: () => void;
};

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'ready'; readonly members: ReadonlyArray<LinearTeamMember> };

type EntriesParams = {
  readonly members: ReadonlyArray<LinearTeamMember>;
  readonly currentName: string | null;
  readonly onPick: (assigneeId: string | null) => void;
};

const entriesOf = ({ members, currentName, onPick }: EntriesParams): ReadonlyArray<MenuEntry> => [
  {
    kind: 'item',
    key: 'unassigned',
    label: 'Unassigned',
    icon: UserX,
    isDisabled: currentName === null,
    onSelect: () => onPick(null),
  },
  ...members.map((member): MenuEntry => ({
    kind: 'item',
    key: member.id,
    label: member.name,
    icon: UserRound,
    isDisabled: member.name === currentName,
    onSelect: () => onPick(member.id),
  })),
];

export const LinearAssigneeMenu = ({
  workspaceId,
  projectId,
  issueId,
  currentName,
  onPick,
  onClose,
}: Props) => {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    linearFetchTeamMembers({ workspaceId, issueId, projectId })
      .then((members) => {
        if (!isCancelled) {
          setLoaded({ kind: 'ready', members });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoaded({ kind: 'failed', message: formatError(error) });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [workspaceId, issueId, projectId, attempt]);

  if (loaded.kind === 'loading') {
    return <SkeletonRow label="Loading people" />;
  }
  if (loaded.kind === 'failed') {
    return (
      <ErrorStrip
        labels={['people']}
        error={new Error(loaded.message)}
        onRetry={() => {
          setLoaded({ kind: 'loading' });
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  return (
    <AppMenuList
      label="Change assignee"
      entries={entriesOf({ members: loaded.members, currentName, onPick })}
      onClose={onClose}
    />
  );
};
