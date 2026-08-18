import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { useAppStore } from '../../../../store';
import { BUG_REPORT_IMAGE_LIMIT } from '../../../../store/slices/bugReportDraft/addBugReportImages';
import type { BugReportImage } from '../../../../store/slices/bugReportDraft/state';
import { useFileDropTarget } from '../../../../shared/hooks/useFileDropTarget';
import { readDroppedAttachment } from '../../../../shared/lib/readDroppedAttachment';
import { readFileAsDataUrl } from '../../../chat/components/ChatInput/lib';

export const BUG_REPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type DroppedPaths = {
  readonly paths: ReadonlyArray<string>;
};

const base64SizeBytes = ({ value }: { readonly value: string }): number => {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
};

const droppedFileName = ({ path }: { readonly path: string }): string =>
  path.split('/').pop() ?? path;

export const useBugReportImages = () => {
  const images = useAppStore((s) => s.bugReportDraft.images);
  const addBugReportImages = useAppStore((s) => s.addBugReportImages);
  const removeBugReportImage = useAppStore((s) => s.removeBugReportImage);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropTargetRef = useRef<HTMLDivElement>(null);
  const atLimit = images.length >= BUG_REPORT_IMAGE_LIMIT;

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      const pictures = files.filter((file) => file.type.startsWith('image/'));
      if (pictures.length < files.length) {
        setNotice('Only images can be attached.');
      }
      const room = BUG_REPORT_IMAGE_LIMIT - images.length;
      if (room <= 0) {
        setNotice(`Up to ${BUG_REPORT_IMAGE_LIMIT} images.`);
        return;
      }
      const accepted: BugReportImage[] = [];
      for (const file of pictures.slice(0, room)) {
        if (file.size > BUG_REPORT_MAX_IMAGE_BYTES) {
          setNotice(`${file.name || 'image'} is over 5MB.`);
          continue;
        }
        try {
          accepted.push({
            id: crypto.randomUUID(),
            fileName: file.name === '' ? 'pasted-image.png' : file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            dataUrl: await readFileAsDataUrl(file),
          });
        } catch {
          setNotice(`Could not read ${file.name || 'that image'}.`);
        }
      }
      if (pictures.length > room) {
        setNotice(`Up to ${BUG_REPORT_IMAGE_LIMIT} images.`);
      }
      if (accepted.length === 0) {
        return;
      }
      addBugReportImages({ images: accepted });
    },
    [images.length, addBugReportImages],
  );

  const ingestDroppedPaths = async ({ paths }: DroppedPaths) => {
    const room = BUG_REPORT_IMAGE_LIMIT - images.length;
    if (room <= 0) {
      setNotice(`Up to ${BUG_REPORT_IMAGE_LIMIT} images.`);
      return;
    }

    const accepted: BugReportImage[] = [];
    for (const path of paths) {
      if (accepted.length >= room) {
        setNotice(`Up to ${BUG_REPORT_IMAGE_LIMIT} images.`);
        break;
      }
      try {
        const result = await readDroppedAttachment({ absolutePath: path });
        if (!result.mimeType.startsWith('image/')) {
          setNotice('Only images can be attached.');
          continue;
        }
        const sizeBytes = base64SizeBytes({ value: result.dataBase64 });
        if (sizeBytes > BUG_REPORT_MAX_IMAGE_BYTES) {
          const oversizedName =
            result.fileName === '' ? droppedFileName({ path }) : result.fileName;
          setNotice(`${oversizedName} is over 5MB.`);
          continue;
        }
        const fileName = result.fileName === '' ? droppedFileName({ path }) : result.fileName;
        accepted.push({
          id: crypto.randomUUID(),
          fileName,
          mimeType: result.mimeType,
          sizeBytes,
          dataUrl: `data:${result.mimeType};base64,${result.dataBase64}`,
        });
      } catch {
        const fileName = droppedFileName({ path });
        setNotice(`Could not read ${fileName === '' ? 'that image' : fileName}.`);
      }
    }
    if (accepted.length === 0) {
      return;
    }
    addBugReportImages({ images: accepted });
  };

  const { isDragging } = useFileDropTarget({
    targetRef: dropTargetRef,
    isEnabled: !atLimit,
    onDropPaths: ({ paths }) => void ingestDroppedPaths({ paths }),
    onAmbiguousDrop: () => setNotice('Drop images on the report image area.'),
    onDisabledDrop: () => setNotice(`Up to ${BUG_REPORT_IMAGE_LIMIT} images.`),
    onUnavailable: () => setNotice('Image drop is unavailable. Use Add files instead.'),
  });

  const onPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files).filter((file) =>
        file.type.startsWith('image/'),
      );
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      void addFiles(files);
    },
    [addFiles],
  );

  const onFileInputChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const files = event.target.files == null ? [] : Array.from(event.target.files);
      event.target.value = '';
      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const openPicker = useCallback(() => {
    setNotice(null);
    fileInputRef.current?.click();
  }, []);

  const removeImage = useCallback(
    (imageId: string) => {
      setNotice(null);
      removeBugReportImage({ imageId });
    },
    [removeBugReportImage],
  );

  return {
    images,
    notice,
    dropTargetRef,
    fileInputRef,
    isDragging,
    openPicker,
    onFileInputChange,
    onPaste,
    removeImage,
    atLimit,
  };
};

export type BugReportImagesControl = ReturnType<typeof useBugReportImages>;
