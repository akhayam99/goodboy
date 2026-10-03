import { useCallback, useEffect, useRef } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { DraftAttachment } from '../../../../../store/slices/agents/setAgentAttachments';
import { deleteAttachment, readAttachment, writeAttachment } from '../../../turn';
import type { ShowToast } from '../../../../../shared/components/Toast';
import {
  dataUrlToBlob,
  readBlobAsBase64,
  type PendingAttachment,
} from '../../../../attachments/pendingAttachment';
import {
  usePendingAttachments,
  type PersistArgs,
} from '../../../../../shared/hooks/usePendingAttachments';

type Params = {
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly sessionWorktree: string | null;
  readonly providerDisconnected: boolean;
  readonly showToast: ShowToast;
};

export const useAttachments = ({
  sessionId,
  selectedAgentId,
  sessionWorktree,
  providerDisconnected,
  showToast,
}: Params) => {
  const setAgentAttachments = useAppStore((s) => s.setAgentAttachments);

  const sessionWorktreeRef = useRef(sessionWorktree);
  sessionWorktreeRef.current = sessionWorktree;
  const attachmentsAgentIdRef = useRef<AgentId | null>(null);
  const pendingRestoreAgentRef = useRef<AgentId | null>(selectedAgentId);

  const persistAttachmentToDisk = useCallback(async (att: PersistArgs): Promise<string | null> => {
    const worktree = sessionWorktreeRef.current;
    if (!worktree) {
      return null;
    }
    try {
      return await writeAttachment({
        worktreeDir: worktree,
        attachmentId: att.id,
        fileName: att.fileName,
        dataBase64: await readBlobAsBase64(att.blob),
      });
    } catch {
      return null;
    }
  }, []);

  const {
    attachments,
    setAttachments,
    isDragging,
    composerRef,
    fileInputRef,
    onPaste,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({
    showToast,
    enabled: !providerDisconnected,
    persistToDisk: persistAttachmentToDisk,
  });

  const restoreAttachments = useCallback(
    async (draftAttachments: ReadonlyArray<DraftAttachment>, agentId: AgentId) => {
      const worktree = sessionWorktreeRef.current;
      if (!worktree && draftAttachments.length > 0) {
        return;
      }
      const restored: PendingAttachment[] = [];
      if (worktree) {
        for (const att of draftAttachments) {
          try {
            const dataUrl = await readAttachment(worktree, att.relPath);
            restored.push({
              id: att.id,
              fileName: att.fileName,
              mimeType: att.mimeType,
              blob: dataUrlToBlob({ dataUrl, mimeType: att.mimeType }),
              relPath: att.relPath,
            });
          } catch {}
        }
      }
      if (pendingRestoreAgentRef.current !== agentId) {
        return;
      }
      setAttachments(restored);
      attachmentsAgentIdRef.current = agentId;
    },
    [],
  );

  useEffect(() => {
    if (selectedAgentId === null) {
      return;
    }
    if (attachmentsAgentIdRef.current !== selectedAgentId) {
      return;
    }
    const draftAtts: DraftAttachment[] = attachments
      .filter((a): a is PendingAttachment & { relPath: string } => a.relPath !== null)
      .map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        relPath: a.relPath,
      }));
    setAgentAttachments(selectedAgentId, draftAtts);
  }, [attachments, selectedAgentId, setAgentAttachments]);

  useEffect(() => {
    pendingRestoreAgentRef.current = selectedAgentId;
    attachmentsAgentIdRef.current = null;
    if (selectedAgentId === null) {
      setAttachments([]);
      return;
    }
    const stored = useAppStore.getState().agentAttachments[selectedAgentId] ?? [];
    void restoreAttachments(stored, selectedAgentId);
  }, [selectedAgentId, sessionWorktree, restoreAttachments]);

  const cleanupSentAttachments = useCallback(
    (atts: ReadonlyArray<PendingAttachment>) => {
      const sentAgentId = useAppStore.getState().selectedAgentId[sessionId] ?? null;
      const worktree = sessionWorktreeRef.current;
      if (worktree) {
        for (const att of atts) {
          if (att.relPath !== null) {
            void deleteAttachment(worktree, att.relPath).catch(() => {});
          }
        }
      }
      if (sentAgentId !== null) {
        useAppStore.getState().clearAgentAttachments(sentAgentId);
      }
    },
    [sessionId],
  );

  return {
    attachments,
    setAttachments,
    isDragging,
    composerRef,
    fileInputRef,
    onPaste,
    onFileInputChange,
    removeAttachment,
    cleanupSentAttachments,
  };
};
