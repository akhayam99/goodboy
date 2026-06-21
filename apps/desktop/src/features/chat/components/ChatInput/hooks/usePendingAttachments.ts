import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { isAllowedAttachment, resolveAttachmentMime } from '../../../attachment-kinds';
import { readDroppedAttachment } from '../../../turn';
import type { ToastKind } from '../../../../../app/components/Toast';
import {
  ATTACHMENT_LIMIT,
  MAX_ATTACHMENT_BYTES,
  extFromMime,
  readFileAsDataUrl,
  type PendingAttachment,
} from '../lib';

type PersistArgs = {
  readonly id: string;
  readonly fileName: string;
  readonly dataUrl: string;
};

interface UsePendingAttachmentsArgs {
  readonly showToast: (kind: ToastKind, message: string) => void;
  readonly enabled?: boolean;
  readonly persistToDisk?: (att: PersistArgs) => Promise<string | null>;
}

export function usePendingAttachments({
  showToast,
  enabled = true,
  persistToDisk,
}: UsePendingAttachmentsArgs) {
  const [attachments, setAttachments] = useState<ReadonlyArray<PendingAttachment>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const persist = useCallback(
    async (att: PersistArgs): Promise<string | null> => {
      if (!persistToDisk) {
        return null;
      }
      return persistToDisk(att);
    },
    [persistToDisk],
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
          const relPath = await persist({ id, fileName, dataUrl });
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
    [showToast, persist],
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

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const persistRef = useRef(persist);
  persistRef.current = persist;

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
          const relPath = await persistRef.current({
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
        } catch {}
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
          if (!enabledRef.current) {
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

  return {
    attachments,
    setAttachments,
    isDragging,
    composerRef,
    fileInputRef,
    addFiles,
    removeAttachment,
    onPaste,
    onFileInputChange,
  };
}
