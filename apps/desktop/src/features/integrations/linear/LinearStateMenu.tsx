import { useEffect, useState } from 'react';
import { formatError, tintClasses, type MenuEntry } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { linearFetchTeamStates, type LinearWorkflowState } from './client';
import { AppMenuList } from '../../actions/AppMenuList';
import { INBOX_STATE_PRESENTATION } from '../../../shared/components/StudioDetail/RecordState';
import { linearStateCategory } from '../../../shared/detail-fields/linearIssueFields';

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

type EntriesParams = {
  readonly states: ReadonlyArray<LinearWorkflowState>;
  readonly currentName: string;
  readonly onPick: (stateId: string) => void;
};

const entriesOf = ({ states, currentName, onPick }: EntriesParams): ReadonlyArray<MenuEntry> =>
  states.map((state) => {
    const presentation = INBOX_STATE_PRESENTATION[linearStateCategory({ type: state.type })];
    return {
      kind: 'item',
      key: state.id,
      label: state.name,
      icon: presentation.icon,
      iconClassName: tintClasses(presentation.tone).icon,
      isDisabled: state.name === currentName,
      onSelect: () => onPick(state.id),
    };
  });

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

  if (loaded.kind === 'loading') {
    return <p className="px-3 py-2 text-faint-foreground italic">Loading states</p>;
  }
  if (loaded.kind === 'failed') {
    return (
      <p role="alert" className="px-3 py-2 text-faint-foreground italic">
        {`Couldn't load states: ${loaded.message}`}
      </p>
    );
  }
  return (
    <AppMenuList
      label="Change status"
      entries={entriesOf({ states: loaded.states, currentName, onPick })}
      onClose={onClose}
    />
  );
};
