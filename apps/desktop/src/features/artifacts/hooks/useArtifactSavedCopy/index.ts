import { useCallback, useEffect, useState } from 'react';
import type { SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
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
  const reportError = useAppStore((s) => s.reportError);

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

  const revealCopy = useCallback(async (): Promise<boolean> => {
    if (workspaceSlug === null) {
      return false;
    }
    try {
      await revealArtifactMirror({ workspaceSlug, folder });
      return true;
    } catch (cause) {
      void reportError({
        title: `Couldn't show ${artifact.title} in its folder`,
        error: cause,
        recovery: NOTHING_CHANGED,
        sessionId,
        retry: revealCopy,
      });
      return false;
    }
  }, [workspaceSlug, folder, artifact.title, sessionId, reportError]);

  const openCopy = useCallback(
    async ({ event }: OpenParams = {}): Promise<boolean> => {
      if (workspaceSlug === null) {
        return false;
      }
      try {
        await openArtifactCopy({ artifact, workspaceSlug, event });
        return true;
      } catch (cause) {
        void reportError({
          title: `Couldn't open ${artifact.title} in the browser`,
          error: cause,
          recovery: NOTHING_CHANGED,
          sessionId,
          retry: () => openCopy({ event }),
        });
        return false;
      }
    },
    [workspaceSlug, artifact, sessionId, reportError],
  );

  const reveal = useCallback(() => {
    void revealCopy();
  }, [revealCopy]);

  const openInBrowser = useCallback(
    ({ event }: OpenParams = {}) => {
      void openCopy({ event });
    },
    [openCopy],
  );

  return { location, reveal, openInBrowser };
};
