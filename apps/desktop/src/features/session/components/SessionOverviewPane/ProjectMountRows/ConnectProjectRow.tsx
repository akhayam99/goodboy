import { FolderPlus } from 'lucide-react';
import { Button, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { Project, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { openWorkspaceProjects } from './openWorkspaceProjects';
import { useConnectProject, type ConnectFailure } from './useConnectProject';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onConnected: (project: Project) => void;
};

const CONNECT_LABEL = 'Connect a repo or folder';

type FailureTextParams = {
  readonly failure: ConnectFailure;
};

const failureText = ({ failure }: FailureTextParams): string => {
  switch (failure.kind) {
    case 'children':
      return 'That folder holds several repositories. Pick them in workspace folders.';
    case 'conflict':
      return `${failure.projectName} belongs to ${failure.workspaceName}. Move it from workspace folders.`;
    case 'error':
      return failure.message;
    default: {
      const unreachable: never = failure;
      return unreachable;
    }
  }
};

export const ConnectProjectRow = ({ workspaceId, onConnected }: Props) => {
  const { isBusy, failure, connect } = useConnectProject({ workspaceId });

  return (
    <div data-connect-project="" className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isBusy}
        aria-busy={isBusy}
        onClick={() => {
          void connect().then((project) => {
            if (project === null) {
              return;
            }
            onConnected(project);
          });
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body text-muted-foreground',
          ROW_INTERACTIVE,
        )}
      >
        <FolderPlus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{isBusy ? 'Connecting…' : CONNECT_LABEL}</span>
      </button>
      {failure === null ? null : (
        <div className="flex flex-col items-start gap-1 px-3 pb-2">
          <p role="alert" className="text-meta text-danger">
            {failureText({ failure })}
          </p>
          <Button variant="ghost" size="sm" onClick={openWorkspaceProjects}>
            Open workspace folders
          </Button>
        </div>
      )}
    </div>
  );
};
