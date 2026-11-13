import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { artifactFolderName } from '../../artifactFolderName';
import {
  locateArtifactMirror,
  revealArtifactMirror,
  type ArtifactMirrorLocation,
} from '../../artifactMirror/artifactMirrorInvoke';
import { openArtifactCopy } from '../../artifactActionRuns';
import type { OpenClick } from '../../../open/types';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type OpenParams = {
  readonly event?: OpenClick;
};

export type ArtifactSavedCopy = Readonly<{
  location: ArtifactMirrorLocation | null;
  error: string | null;
  reveal: () => void;
  openInBrowser: (params?: OpenParams) => void;
}>;

type Params = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
};

export const useArtifactSavedCopy = ({ sessionId, artifact }: Params): ArtifactSavedCopy => {
  const workspaceSlug = useAppStore((s) => {
    const workspaceId = sessionById(s.sessions, sessionId)?.workspaceId;
    return s.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
  });
  const folder = artifactFolderName({ artifact });
  const [location, setLocation] = useState<ArtifactMirrorLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceSlug === null) {
      setLocation(null);
      return;
    }
    let isActive = true;
    locateArtifactMirror({ workspaceSlug, folder })
      .then((found) => {
        if (isActive) {
          setLocation(found);
        }
      })
      .catch(() => {
        if (isActive) {
          setLocation(null);
        }
      });
    return () => {
      isActive = false;
    };
  }, [workspaceSlug, folder, artifact.updatedAt]);

  const reveal = useCallback(() => {
    if (workspaceSlug === null) {
      return;
    }
    setError(null);
    revealArtifactMirror({ workspaceSlug, folder }).catch((cause: unknown) =>
      setError(formatError(cause)),
    );
  }, [workspaceSlug, folder]);

  const openInBrowser = useCallback(
    ({ event }: OpenParams = {}) => {
      if (workspaceSlug === null) {
        return;
      }
      setError(null);
      openArtifactCopy({ artifact, workspaceSlug, event }).catch((cause: unknown) =>
        setError(formatError(cause)),
      );
    },
    [workspaceSlug, artifact],
  );

  return { location, error, reveal, openInBrowser };
};
