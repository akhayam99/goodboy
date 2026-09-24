import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  usePendingAttachments,
  type AttachmentDropNotices,
} from '../../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { dataUrlToBase64 } from '../../../../chat/components/ChatInput/lib';
import { deleteAttachment, writeAttachment } from '../../../../chat/turn';
import type { ArtifactAttachment } from '../../../artifactAttachments';

type Params = Readonly<{
  sessionId: SessionId;
  onChange: (attachments: ReadonlyArray<ArtifactAttachment>) => void;
}>;

export type ArtifactAttachmentsHandle = Readonly<{
  attachments: ReadonlyArray<ArtifactAttachment>;
  worktree: string | null;
  isDragging: boolean;
  note: string | null;
  composerRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  remove: (params: { readonly id: string }) => void;
  discardAll: () => void;
}>;

const UNSTORED_NOTE = 'could not store that file, nothing was attached';

const DROP_NOTICES: AttachmentDropNotices = {
  ambiguous: 'Drop the file on the attachments box to attach it.',
  disabled: 'This session has no worktree yet, so nothing can be attached.',
  unavailable: 'File drop is unavailable. Use Add files instead.',
};

export const useArtifactAttachments = ({
  sessionId,
  onChange,
}: Params): ArtifactAttachmentsHandle => {
  const worktree = useAppStore((s) => s.sessionWorktrees[sessionId]?.[0] ?? null);
  const worktreeRef = useRef<string | null>(worktree);
  worktreeRef.current = worktree;
  const [note, setNote] = useState<string | null>(null);

  const persistToDisk = useCallback(
    async (att: {
      readonly id: string;
      readonly fileName: string;
      readonly dataUrl: string;
    }): Promise<string | null> => {
      const dir = worktreeRef.current;
      if (dir === null) {
        return null;
      }
      try {
        return await writeAttachment({
          worktreeDir: dir,
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

  const { attachments, setAttachments, isDragging, composerRef, fileInputRef, onFileInputChange } =
    usePendingAttachments({
      showToast: ({ message }) => setNote(message),
      enabled: worktree !== null,
      notices: DROP_NOTICES,
      persistToDisk,
    });

  const emitted: ReadonlyArray<ArtifactAttachment> = attachments.flatMap((attachment) =>
    attachment.relPath === null
      ? []
      : [
          {
            id: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            relPath: attachment.relPath,
          },
        ],
  );
  const hasUnstored = emitted.length < attachments.length;

  useEffect(() => {
    if (!hasUnstored) {
      return;
    }
    setNote(UNSTORED_NOTE);
    setAttachments((previous) => previous.filter((entry) => entry.relPath !== null));
  }, [hasUnstored, setAttachments]);

  const emittedKey = emitted.map((attachment) => attachment.relPath).join('|');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emittedRef = useRef(emitted);
  emittedRef.current = emitted;

  useEffect(() => {
    onChangeRef.current(emittedRef.current);
  }, [emittedKey]);

  const forget = useCallback(({ relPath }: { readonly relPath: string }) => {
    const dir = worktreeRef.current;
    if (dir === null) {
      return;
    }
    void deleteAttachment(dir, relPath).catch(() => undefined);
  }, []);

  const remove = useCallback(
    ({ id }: { readonly id: string }) => {
      setNote(null);
      const target = emittedRef.current.find((entry) => entry.id === id);
      if (target !== undefined) {
        forget({ relPath: target.relPath });
      }
      setAttachments((previous) => previous.filter((entry) => entry.id !== id));
    },
    [forget, setAttachments],
  );

  const discardAll = useCallback(() => {
    for (const entry of emittedRef.current) {
      forget({ relPath: entry.relPath });
    }
    setAttachments([]);
  }, [forget, setAttachments]);

  return {
    attachments: emitted,
    worktree,
    isDragging,
    note,
    composerRef,
    fileInputRef,
    onFileInputChange,
    remove,
    discardAll,
  };
};
