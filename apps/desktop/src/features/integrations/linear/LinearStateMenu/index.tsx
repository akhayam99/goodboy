import { useEffect, useState } from 'react';
import { MenuItems, formatError, type OverflowMenuItem } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearFetchTeamStates, type LinearWorkflowState } from '../client';
import { INBOX_STATE_PRESENTATION } from '../../../../shared/components/StudioDetail/RecordState';
import { linearStateCategory } from '../../../../shared/detail-fields/linearIssueFields';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly issueId: string;
  readonly currentName: string;
  readonly onPick: (stateId: string) => void;
  readonly onClose: () => void;
};

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'ready'; readonly states: ReadonlyArray<LinearWorkflowState> };

type ItemsParams = {
  readonly loaded: Loaded;
  readonly currentName: string;
  readonly onPick: (stateId: string) => void;
};

const itemsOf = ({ loaded, currentName, onPick }: ItemsParams): ReadonlyArray<OverflowMenuItem> => {
  if (loaded.kind === 'loading') {
    return [{ kind: 'empty', key: 'loading', label: 'Loading states' }];
  }
  if (loaded.kind === 'failed') {
    return [{ kind: 'empty', key: 'failed', label: `Couldn't load states: ${loaded.message}` }];
  }
  return loaded.states.map((state) => {
    const presentation = INBOX_STATE_PRESENTATION[linearStateCategory({ type: state.type })];
    return {
      kind: 'item',
      key: state.id,
      label: state.name,
      icon: presentation.icon,
      tone: presentation.tone,
      disabled: state.name === currentName,
      onClick: () => onPick(state.id),
    };
  });
};

export const LinearStateMenu = ({
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
    linearFetchTeamStates({ workspaceId, issueId, projectId })
      .then((states) => {
        if (!isCancelled) {
          setLoaded({ kind: 'ready', states });
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
