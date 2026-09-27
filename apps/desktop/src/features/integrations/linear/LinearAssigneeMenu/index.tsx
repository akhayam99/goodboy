import { useEffect, useState } from 'react';
import { UserRound, UserX } from 'lucide-react';
import { MenuItems, formatError, type OverflowMenuItem } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearFetchTeamMembers, type LinearTeamMember } from '../client';

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

type ItemsParams = {
  readonly loaded: Loaded;
  readonly currentName: string | null;
  readonly onPick: (assigneeId: string | null) => void;
};

const itemsOf = ({ loaded, currentName, onPick }: ItemsParams): ReadonlyArray<OverflowMenuItem> => {
  if (loaded.kind === 'loading') {
    return [{ kind: 'empty', key: 'loading', label: 'Loading people' }];
  }
  if (loaded.kind === 'failed') {
    return [{ kind: 'empty', key: 'failed', label: `Couldn't load people: ${loaded.message}` }];
  }
  const unassign: OverflowMenuItem = {
    kind: 'item',
    key: 'unassigned',
    label: 'Unassigned',
    icon: UserX,
    disabled: currentName === null,
    onClick: () => onPick(null),
  };
  return [
    unassign,
    ...loaded.members.map((member): OverflowMenuItem => ({
      kind: 'item',
      key: member.id,
      label: member.name,
      icon: UserRound,
      disabled: member.name === currentName,
      onClick: () => onPick(member.id),
    })),
  ];
};

export const LinearAssigneeMenu = ({
  workspaceId,
  projectId,
  issueId,
  currentName,
  onPick,
  onClose,
}: Props) => {
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });

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
  }, [workspaceId, issueId, projectId]);

  return (
    <div className="flex flex-col py-1">
      <MenuItems items={itemsOf({ loaded, currentName, onPick })} onClose={onClose} />
    </div>
  );
};
