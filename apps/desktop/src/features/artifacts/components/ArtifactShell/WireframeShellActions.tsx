import { useMemo, useState } from 'react';
import { parseWireframeSource, type WireframeScreen } from '@goodboy/core';
import { cn, formatError } from '@goodboy/ui';
import type { SessionId, WireframeArtifact } from '@goodboy/types';
import type { ArtifactExport } from '../../hooks/useArtifactExport';
import { useWireframeRespawn } from '../../../wireframes/useWireframeRespawn';
import { useWireframeFolderExport } from '../../../wireframes/useWireframeFolderExport';
import { folderExportNote } from '../../../wireframes/useWireframeFolderExport/folderExportNote';
import {
  WIREFRAME_FIDELITY_VARIANT_LABEL,
  type WireframeFidelity,
} from '../../../wireframes/wireframeFidelity';
import { WireframeExportMenu } from '../../../wireframes/components/WireframeExportMenu';
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
  const [note, setNote] = useState<Note | null>(null);
  const other: WireframeFidelity = fidelity === 'low' ? 'high' : 'low';
  const screen = useMemo((): WireframeScreen | null => {
    if (screenId === null) {
      return null;
    }
    const parsed = parseWireframeSource({ source: artifact.sourceText });
    if (parsed.status !== 'valid') {
      return null;
    }
    return parsed.document.screens.find((candidate) => candidate.id === screenId) ?? null;
  }, [artifact.sourceText, screenId]);

  const copyScreen = (target: WireframeScreen) => {
    const clipboard = globalThis.navigator?.clipboard ?? null;
    if (clipboard === null) {
      setNote({ text: 'This system has no clipboard available', isError: true });
      return;
    }
    clipboard
      .writeText(JSON.stringify(target, null, 2))
      .then(() => setNote({ text: `${target.title} copied as JSON`, isError: false }))
      .catch((cause: unknown) => setNote({ text: formatError(cause), isError: true }));
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
            'min-w-0 max-w-48 truncate text-2xs',
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
          newVariant: {
            onClick: () => respawn({ fidelity: other }),
            isDisabled: isRespawning,
            hint: `Runs the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[other]}, leaving this one untouched`,
          },
        }}
        renderSecondary={(id) =>
          id === 'export' ? (
            <WireframeExportMenu
              screen={screen}
              isBusy={exporter.status.kind === 'busy' || folderExport.status.kind === 'busy'}
              onExportFolder={() => {
                setNote(null);
                void folderExport.exportFolder();
              }}
              onSaveCopy={() => void exporter.saveSource()}
              onCopyJson={() => void exporter.copySource()}
              onCopyScreen={copyScreen}
            />
          ) : null
        }
      />
    </span>
  );
};
