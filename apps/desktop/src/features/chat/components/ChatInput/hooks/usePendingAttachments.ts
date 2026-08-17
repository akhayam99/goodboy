import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { isAllowedAttachment, resolveAttachmentMime } from '../../../attachment-kinds';
import type { ToastKind } from '../../../../../app/components/Toast';
import { useFileDropTarget } from '../../../../../shared/hooks/useFileDropTarget';
import { readDroppedAttachment } from '../../../../../shared/lib/readDroppedAttachment';
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

type Params = {
  readonly showToast: (kind: ToastKind, message: string) => void;
  readonly enabled?: boolean;
  readonly persistToDisk?: (att: PersistArgs) => Promise<string | null>;
};

type DroppedPaths = {
  readonly paths: ReadonlyArray<string>;
};

const droppedFileName = ({ path }: { readonly path: string }): string =>
  path.split('/').pop() ?? path;

export const usePendingAttachments = ({ showToast, enabled = true, persistToDisk }: Params) => {
  const [attachments, setAttachments] = useState<ReadonlyArray<PendingAttachment>>([]);
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

  const ingestDroppedPaths = async ({ paths }: DroppedPaths) => {
    const supported = paths.filter((path) =>
      isAllowedAttachment({ name: droppedFileName({ path }), type: '' }),
    );
    const unsupported = paths.length - supported.length;
    if (unsupported > 0) {
      showToast(
        'warning',
        `${unsupported} file${unsupported === 1 ? '' : 's'} skipped, unsupported type`,
      );
    }
    const dropped: PendingAttachment[] = [];
    const rejected: string[] = [];
    for (const path of supported) {
      const name = droppedFileName({ path });
      try {
        const result = await readDroppedAttachment({ absolutePath: path });
        const id = crypto.randomUUID();
        const dataUrl = `data:${result.mimeType};base64,${result.dataBase64}`;
        const relPath = await persist({
          id,
          fileName: result.fileName,
          dataUrl,
        });
        dropped.push({
          id,
          fileName: result.fileName,
          mimeType: result.mimeType,
          dataUrl,
          relPath,
        });
      } catch {
        rejected.push(name);
      }
    }
    if (rejected.length > 0) {
      const label =
        rejected.length === 1
          ? `could not attach ${rejected[0]}, it may be over 15MB`
          : `${rejected.length} files could not be read`;
      showToast('error', label);
    }
    if (dropped.length === 0) {
      return;
    }
    setAttachments((previous) => {
      const room = ATTACHMENT_LIMIT - previous.length;
      if (room <= 0) {
        showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
        return previous;
      }
      if (dropped.length > room) {
        showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
      }
      return [...previous, ...dropped.slice(0, room)];
    });
  };

  const { isDragging } = useFileDropTarget({
    targetRef: composerRef,
    isEnabled: enabled,
    onDropPaths: ({ paths }) => void ingestDroppedPaths({ paths }),
    onAmbiguousDrop: () => showToast('warning', 'drop the file on a message box to attach it'),
    onDisabledDrop: () => showToast('warning', 'connect the provider before attaching files'),
    onUnavailable: () =>
      showToast('warning', 'file drop is unavailable, use the paperclip instead'),
  });

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
};
