import { useState } from 'react';
import { cn, formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ArtifactExport } from '../../hooks/useArtifactExport';
import { useWireframeRespawn } from '../../../wireframes/useWireframeRespawn';
import { useWireframeFolderExport } from '../../../wireframes/useWireframeFolderExport';
import { folderExportNote } from '../../../wireframes/useWireframeFolderExport/folderExportNote';
import { openWireframeInBrowser } from '../../../wireframes/openWireframeInBrowser';
import {
  WIREFRAME_FIDELITY_VARIANT_LABEL,
  type WireframeFidelity,
} from '../../../wireframes/wireframeFidelity';
import type { ArtifactActionSet } from './artifactActions';
import { ArtifactShellActions, type ArtifactActionHandles } from './ArtifactShellActions';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly set: ArtifactActionSet;
  readonly handles: ArtifactActionHandles;
  readonly exporter: ArtifactExport;
  readonly screenId: string | null;
};

type Note = Readonly<{ text: string; isError: boolean }>;

export const WireframeShellActions = ({
  sessionId,
  artifact,
  set,
  handles,
  exporter,
  screenId,
}: Props) => {
  const { fidelity, isRespawning, error, respawn } = useWireframeRespawn({ sessionId, artifact });
  const folderExport = useWireframeFolderExport({ artifact });
  const workspaceSlug = useAppStore((s) => {
    const workspaceId = s.sessions.find((session) => session.id === sessionId)?.workspaceId;
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
            'min-w-0 max-w-48 truncate text-secondary',
            message.isError ? 'text-danger' : 'text-muted-foreground',
          )}
        >
          {message.text}
        </span>
      )}
      <ArtifactShellActions
        set={set}
        handles={{
          ...handles,
          openInBrowser: {
            onClick: openInBrowser,
            isBusy: isOpening,
            isDisabled: workspaceSlug === null || isOpening,
            hint:
              screenId === null
                ? 'Opens the saved folder in your browser'
                : 'Opens this screen from the saved folder in your browser',
          },
          copySource: {
            onClick: () => void exporter.copySource(),
            label: 'Copy spec',
            isDisabled: isBusy,
          },
          saveSource: {
            onClick: () => {
              setNote(null);
              void folderExport.exportFolder();
            },
            label: 'Save a copy to…',
            isDisabled: isBusy,
          },
          newVariant: {
            onClick: () => respawn({ fidelity: other }),
            isDisabled: isRespawning,
            hint: `Runs the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[other]}, leaving this one untouched`,
          },
        }}
      />
    </span>
  );
};
