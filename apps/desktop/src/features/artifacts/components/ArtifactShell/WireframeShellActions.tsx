import { useState } from 'react';
import { cn, formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ArtifactExport } from '../../hooks/useArtifactExport';
import { useWireframeRespawn } from '../../../wireframes/useWireframeRespawn';
import { useWireframeFolderExport } from '../../../wireframes/useWireframeFolderExport';
import { folderExportNote } from '../../../wireframes/useWireframeFolderExport/folderExportNote';
import { openWireframeInBrowser } from '../../../wireframes/openWireframeInBrowser';
import type { WireframeFidelity } from '../../../wireframes/wireframeFidelity';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';
import { ArtifactShellActions } from './ArtifactShellActions';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly target: ArtifactActionTarget;
  readonly exporter: ArtifactExport;
  readonly screenId: string | null;
  readonly onArm: (params: {
    readonly action: ResolvedAction;
    readonly run: () => Promise<void>;
  }) => void;
};

type Note = Readonly<{ text: string; isError: boolean }>;

export const WireframeShellActions = ({
  sessionId,
  artifact,
  target,
  exporter,
  screenId,
  onArm,
}: Props) => {
  const { fidelity, isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });
  const folderExport = useWireframeFolderExport({ artifact });
  const workspaceSlug = useAppStore((s) => {
    const workspaceId = sessionById(s.sessions, sessionId)?.workspaceId;
    return s.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
  });
  const [note, setNote] = useState<Note | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const other: WireframeFidelity = fidelity === 'low' ? 'high' : 'low';
  const isBusy = exporter.status.kind === 'busy' || folderExport.status.kind === 'busy';

  const openInBrowser = () => {
    if (workspaceSlug === null || isOpening) {
      return;
    }
    setNote(null);
    setIsOpening(true);
    openWireframeInBrowser({ artifact, workspaceSlug, screenId })
      .catch((cause: unknown) => setNote({ text: formatError(cause), isError: true }))
      .finally(() => setIsOpening(false));
  };

  const folderNote = folderExportNote({ status: folderExport.status });
  const message = error === null ? (note ?? folderNote) : { text: error, isError: true };

  return (
    <span className="flex min-w-0 items-center gap-2">
      {message === null ? null : (
        <span
          role={message.isError ? 'alert' : 'status'}
          title={message.text}
          className={cn(
            'min-w-0 max-w-48 truncate text-meta',
            message.isError ? 'text-danger' : 'text-muted-foreground',
          )}
        >
          {message.text}
        </span>
      )}
      <ArtifactShellActions
        onArm={onArm}
        target={{
          ...target,
          ports: {
            ...target.ports,
            openInBrowser: {
              run: openInBrowser,
              isBusy: isOpening,
              blockedReason: workspaceSlug === null ? 'This session has no workspace' : null,
              description:
                screenId === null
                  ? 'Opens the saved folder in your browser'
                  : 'Opens this screen from the saved folder in your browser',
            },
            copySource: {
              run: exporter.copySource,
              label: 'Copy spec',
              isBusy,
            },
            saveSource: {
              run: () => {
                setNote(null);
                void folderExport.exportFolder();
              },
              label: 'Save a copy to…',
              isBusy,
            },
            newVariant: {
              run: () => respawn({ fidelity: other }),
              isBusy: isRespawning,
            },
          },
        }}
      />
    </span>
  );
};
