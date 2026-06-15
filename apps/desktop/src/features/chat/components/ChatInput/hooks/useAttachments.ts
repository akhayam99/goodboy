import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { DraftAttachment } from '../../../../../store/slices/agents/setAgentAttachments';
import {
  deleteAttachment,
  readAttachment,
  readDroppedAttachment,
  writeAttachment,
} from '../../../turn';
import { isAllowedAttachment, resolveAttachmentMime } from '../../../attachment-kinds';
import type { ToastKind } from '../../../../../app/components/Toast';
import {
  ATTACHMENT_LIMIT,
  MAX_ATTACHMENT_BYTES,
  dataUrlToBase64,
  extFromMime,
  readFileAsDataUrl,
  type PendingAttachment,
} from '../lib';

interface UseAttachmentsArgs {
  readonly sessionId: SessionId;
  readonly selectedAgentId: AgentId | null;
  readonly sessionWorktree: string | null;
  readonly providerDisconnected: boolean;
  readonly showToast: (kind: ToastKind, message: string) => void;
}

export function useAttachments({
  sessionId,
  selectedAgentId,
  sessionWorktree,
  providerDisconnected,
  showToast,
}: UseAttachmentsArgs) {
  const [attachments, setAttachments] = useState<ReadonlyArray<PendingAttachment>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const setAgentAttachments = useAppStore((s) => s.setAgentAttachments);

  const sessionWorktreeRef = useRef(sessionWorktree);
  sessionWorktreeRef.current = sessionWorktree;
  const attachmentsAgentIdRef = useRef<AgentId | null>(null);
  const pendingRestoreAgentRef = useRef<AgentId | null>(selectedAgentId);

  const persistAttachmentToDisk = useCallback(
    async (att: {
      readonly id: string;
      readonly fileName: string;
      readonly dataUrl: string;
    }): Promise<string | null> => {
      const worktree = sessionWorktreeRef.current;
      if (!worktree) {
        return null;
      }
      try {
        return await writeAttachment({
          worktreeDir: worktree,
          attachmentId: att.id,
          fileName: att.fileName,
          dataBase64: dataUrlToBase64(att.dataUrl),
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      const allowed = files.filter(isAllowedAttachment);
      const skipped = files.length - allowed.length;
      if (skipped > 0) {
        showToast(
          'warning',
          `${skipped} file${skipped === 1 ? '' : 's'} skipped, unsupported type`,
        );
      }
      if (allowed.length === 0) {
        return;
      }
      const accepted: PendingAttachment[] = [];
      for (const file of allowed) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast('error', `${file.name || 'file'} is over 15MB`);
          continue;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const mimeType = resolveAttachmentMime(file);
          const id = crypto.randomUUID();
          const fileName = file.name || `pasted-file.${extFromMime(mimeType)}`;
          const relPath = await persistAttachmentToDisk({ id, fileName, dataUrl });
          accepted.push({ id, fileName, mimeType, dataUrl, relPath });
        } catch {
          showToast('error', `could not read ${file.name || 'file'}`);
        }
      }
      if (accepted.length === 0) {
        return;
      }
      setAttachments((prev) => {
        const room = ATTACHMENT_LIMIT - prev.length;
        if (room <= 0) {
          showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
          return prev;
        }
        if (accepted.length > room) {
          showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
        }
        return [...prev, ...accepted.slice(0, room)];
      });
    },
    [showToast, persistAttachmentToDisk],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const onPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files).filter(isAllowedAttachment);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const onFileInputChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      void addFiles(files);
    }
    event.target.value = '';
  };

  const providerDisconnectedRef = useRef(providerDisconnected);
  providerDisconnectedRef.current = providerDisconnected;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const persistAttachmentToDiskRef = useRef(persistAttachmentToDisk);
  persistAttachmentToDiskRef.current = persistAttachmentToDisk;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    const isInsideComposer = (px: number, py: number): boolean => {
      const el = composerRef.current;
      if (!el) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const candidates: ReadonlyArray<readonly [number, number]> = [
        [px / dpr, py / dpr],
        [px, py],
      ];
      return candidates.some(
        ([x, y]) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
      );
    };

    const ingestDroppedPaths = async (paths: ReadonlyArray<string>) => {
      const dropped: PendingAttachment[] = [];
      for (const path of paths) {
        try {
          const r = await readDroppedAttachment(path);
          const id = crypto.randomUUID();
          const dataUrl = `data:${r.mimeType};base64,${r.dataBase64}`;
          const relPath = await persistAttachmentToDiskRef.current({
            id,
            fileName: r.fileName,
            dataUrl,
          });
          dropped.push({
            id,
            fileName: r.fileName,
            mimeType: r.mimeType,
            dataUrl,
            relPath,
          });
        } catch {
          // Unsupported / oversize drops are silently skipped: otherwise a
          // folder drop would spam a toast per child.
        }
      }
      if (dropped.length === 0) {
        return;
      }
      setAttachments((prev) => {
        const room = ATTACHMENT_LIMIT - prev.length;
        if (room <= 0) {
          showToastRef.current('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
          return prev;
        }
        if (dropped.length > room) {
          showToastRef.current('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
        }
        return [...prev, ...dropped.slice(0, room)];
      });
    };

    void (async () => {
      try {
        const off = await getCurrentWebview().onDragDropEvent((event) => {
          const p = event.payload;
          if (providerDisconnectedRef.current) {
            setIsDragging(false);
            return;
          }
          switch (p.type) {
            case 'enter':
            case 'over':
              setIsDragging(true);
              break;
            case 'leave':
              setIsDragging(false);
              break;
            case 'drop': {
              setIsDragging(false);
              if (!isInsideComposer(p.position.x, p.position.y)) {
                return;
              }
              void ingestDroppedPaths(p.paths);
              break;
            }
          }
        });
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch (err) {
        console.warn('drag-drop listener registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

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
              dataUrl,
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
}
