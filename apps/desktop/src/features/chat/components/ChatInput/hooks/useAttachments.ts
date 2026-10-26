import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { DraftAttachment } from '../../../../../store/slices/agents/setAgentAttachments';
import { deleteAttachment, readAttachment, writeAttachment } from '../../../turn';
import type { ShowToast } from '../../../../../shared/components/Toast';
import {
  ATTACHMENT_LIMIT,
  ATTACHMENT_LIMIT_NOTICE,
  dataUrlToBlob,
  readBlobAsBase64,
  type PendingAttachment,
} from '../../../../attachments/pendingAttachment';
import { OUTPUT_HANDOFF_MIME, type OutputHandoff } from '../../../../../shared/utils/outputHandoff';
import {
  usePendingAttachments,
  type PersistArgs,
} from '../../../../../shared/hooks/usePendingAttachments';

export type CleanupSentParams = {
  readonly atts: ReadonlyArray<PendingAttachment>;
  readonly agentId: AgentId;
};

export type AttachOutputHandoffsParams = {
  readonly agentId: AgentId;
  readonly handoffs: ReadonlyArray<OutputHandoff>;
};

type Params = {
  readonly selectedAgentId: AgentId | null;
  readonly sessionWorktree: string | null;
  readonly providerDisconnected: boolean;
  readonly showToast: ShowToast;
};

export const useAttachments = ({
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
  const [restoredAgentId, setRestoredAgentId] = useState<AgentId | null>(null);

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
      setRestoredAgentId(agentId);
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
    setRestoredAgentId(null);
    if (selectedAgentId === null) {
      setAttachments([]);
      return;
    }
    const stored = useAppStore.getState().agentAttachments[selectedAgentId] ?? [];
    void restoreAttachments(stored, selectedAgentId);
  }, [selectedAgentId, sessionWorktree, restoreAttachments]);

  const cleanupSentAttachments = useCallback(({ atts, agentId }: CleanupSentParams) => {
    const worktree = sessionWorktreeRef.current;
    if (worktree) {
      for (const att of atts) {
        if (att.relPath !== null) {
          void deleteAttachment(worktree, att.relPath).catch(() => {});
        }
      }
    }
    useAppStore.getState().clearAgentAttachments(agentId);
  }, []);

  const attachOutputHandoffs = useCallback(
    async ({ agentId, handoffs }: AttachOutputHandoffsParams): Promise<boolean> => {
      const built: PendingAttachment[] = [];
      for (const handoff of handoffs) {
        const blob = new Blob([handoff.text], { type: OUTPUT_HANDOFF_MIME });
        const id = crypto.randomUUID();
        const relPath = await persistAttachmentToDisk({ id, fileName: handoff.fileName, blob });
        built.push({
          id,
          fileName: handoff.fileName,
          mimeType: OUTPUT_HANDOFF_MIME,
          blob,
          relPath,
        });
      }
      if (attachmentsAgentIdRef.current !== agentId) {
        return false;
      }
      setAttachments((previous) => {
        const room = Math.max(ATTACHMENT_LIMIT - previous.length, 0);
        if (built.length > room) {
          showToast({ kind: 'warning', message: ATTACHMENT_LIMIT_NOTICE });
        }
        return [...previous, ...built.slice(0, room)];
      });
      return true;
    },
    [persistAttachmentToDisk, setAttachments, showToast],
  );

  return {
    isRestored: selectedAgentId !== null && restoredAgentId === selectedAgentId,
    attachOutputHandoffs,
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
