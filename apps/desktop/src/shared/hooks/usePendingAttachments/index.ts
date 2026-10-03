import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import {
  isAllowedAttachment,
  resolveAttachmentMime,
} from '../../../features/chat/attachment-kinds';
import type { ShowToast } from '../../components/Toast';
import { useFileDropTarget } from '../useFileDropTarget';
import { readDroppedAttachment } from '../../lib/readDroppedAttachment';
import {
  ATTACHMENT_LIMIT,
  MAX_ATTACHMENT_BYTES,
  base64ToBlob,
  extFromMime,
  type PendingAttachment,
} from '../../../features/attachments/pendingAttachment';

export type PersistArgs = {
  readonly id: string;
  readonly fileName: string;
  readonly blob: Blob;
};

export type AttachmentDropNotices = Readonly<{
  ambiguous: string;
  disabled: string;
  unavailable: string;
}>;

type Params = {
  readonly showToast: ShowToast;
  readonly enabled?: boolean;
  readonly notices?: AttachmentDropNotices;
  readonly persistToDisk?: (att: PersistArgs) => Promise<string | null>;
};

type DroppedPaths = {
  readonly paths: ReadonlyArray<string>;
};

type NameParams = {
  readonly fileName: string;
};

const COMPOSER_DROP_NOTICES: AttachmentDropNotices = {
  ambiguous: 'Drop the file on a message box to attach it.',
  disabled: 'Connect the provider before attaching files.',
  unavailable: 'File drop is unavailable. Use Attach files instead.',
};

const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);

const ATTACHMENT_LIMIT_NOTICE = `Up to ${ATTACHMENT_LIMIT} files per message.`;

const tooLargeNotice = ({ fileName }: NameParams): string =>
  `${fileName} is over ${MAX_ATTACHMENT_MB} MB.`;

const droppedFileName = ({ path }: { readonly path: string }): string =>
  path.split('/').pop() ?? path;

export const usePendingAttachments = ({
  showToast,
  enabled = true,
  notices = COMPOSER_DROP_NOTICES,
  persistToDisk,
}: Params) => {
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

  const admit = useCallback(
    (accepted: ReadonlyArray<PendingAttachment>) => {
      if (accepted.length === 0) {
        return;
      }
      setAttachments((previous) => {
        const room = ATTACHMENT_LIMIT - previous.length;
        if (accepted.length > room) {
          showToast({ kind: 'warning', message: ATTACHMENT_LIMIT_NOTICE });
        }
        if (room <= 0) {
          return previous;
        }
        return [...previous, ...accepted.slice(0, room)];
      });
    },
    [showToast],
  );

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      const allowed = files.filter(isAllowedAttachment);
      const skipped = files.length - allowed.length;
      if (skipped > 0) {
        showToast({
          kind: 'warning',
          message: `Skipped ${skipped} file${skipped === 1 ? '' : 's'} of an unsupported type.`,
        });
      }
      const accepted: PendingAttachment[] = [];
      for (const file of allowed) {
        const mimeType = resolveAttachmentMime(file);
        const fileName = file.name || `pasted-file.${extFromMime(mimeType)}`;
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast({ kind: 'warning', message: tooLargeNotice({ fileName }) });
          continue;
        }
        try {
          const id = crypto.randomUUID();
          const relPath = await persist({ id, fileName, blob: file });
          accepted.push({ id, fileName, mimeType, blob: file, relPath });
        } catch {
          showToast({ kind: 'warning', message: `Couldn't read ${fileName}.` });
        }
      }
      admit(accepted);
    },
    [showToast, persist, admit],
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
      showToast({
        kind: 'warning',
        message: `Skipped ${unsupported} file${unsupported === 1 ? '' : 's'} of an unsupported type.`,
      });
    }
    const dropped: PendingAttachment[] = [];
    const rejected: string[] = [];
    for (const path of supported) {
      const name = droppedFileName({ path });
      try {
        const result = await readDroppedAttachment({ absolutePath: path });
        const blob = base64ToBlob({ dataBase64: result.dataBase64, mimeType: result.mimeType });
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          showToast({ kind: 'warning', message: tooLargeNotice({ fileName: result.fileName }) });
          continue;
        }
        const id = crypto.randomUUID();
        const relPath = await persist({ id, fileName: result.fileName, blob });
        dropped.push({ id, fileName: result.fileName, mimeType: result.mimeType, blob, relPath });
      } catch {
        rejected.push(name);
      }
    }
    if (rejected.length > 0) {
      const label =
        rejected.length === 1
          ? `Couldn't attach ${rejected[0]}. It may be over ${MAX_ATTACHMENT_MB} MB.`
          : `Couldn't read ${rejected.length} files.`;
      showToast({ kind: 'warning', message: label });
    }
    admit(dropped);
  };

  const { isDragging } = useFileDropTarget({
    targetRef: composerRef,
    isEnabled: enabled,
    onDropPaths: ({ paths }) => void ingestDroppedPaths({ paths }),
    onAmbiguousDrop: () => showToast({ kind: 'warning', message: notices.ambiguous }),
    onDisabledDrop: () => showToast({ kind: 'warning', message: notices.disabled }),
    onUnavailable: () => showToast({ kind: 'warning', message: notices.unavailable }),
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
