import { useEffect, useRef, useState } from 'react';
import { readAttachment } from '../../../chat/turn';
import type { AttachmentThumbnail } from '../../components/AttachmentChip';

export type ThumbnailSource = {
  readonly id: string;
  readonly relPath: string;
  readonly workingDir: string | null;
};

type Params = {
  readonly sources: ReadonlyArray<ThumbnailSource>;
};

type SettleParams = {
  readonly id: string;
  readonly request: number;
  readonly thumbnail: AttachmentThumbnail;
};

type RequestEntry = {
  readonly token: string;
  readonly request: number;
};

type TokenParams = {
  readonly relPath: string;
  readonly workingDir: string | null;
};

const tokenOf = ({ relPath, workingDir }: TokenParams): string => `${workingDir ?? ''}\n${relPath}`;

export const useAttachmentThumbnails = ({
  sources,
}: Params): Readonly<Record<string, AttachmentThumbnail>> => {
  const [thumbnails, setThumbnails] = useState<Readonly<Record<string, AttachmentThumbnail>>>({});
  const requestedRef = useRef(new Map<string, RequestEntry>());
  const requestCountRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const requested = requestedRef.current;
    const settle = ({ id, request, thumbnail }: SettleParams) => {
      if (!isMountedRef.current || requested.get(id)?.request !== request) {
        return;
      }
      setThumbnails((current) => ({ ...current, [id]: thumbnail }));
    };
    const ids = new Set(sources.map((source) => source.id));
    for (const id of [...requested.keys()]) {
      if (!ids.has(id)) {
        requested.delete(id);
      }
    }
    setThumbnails((current) => {
      const kept = Object.entries(current).filter(([id]) => ids.has(id));
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
    });
    for (const source of sources) {
      const { id, relPath, workingDir } = source;
      const token = tokenOf({ relPath, workingDir });
      if (requested.get(id)?.token === token) {
        continue;
      }
      requestCountRef.current += 1;
      const request = requestCountRef.current;
      requested.set(id, { token, request });
      if (workingDir === null) {
        settle({ id, request, thumbnail: { status: 'failed' } });
        continue;
      }
      setThumbnails((current) => ({ ...current, [id]: { status: 'loading' } }));
      readAttachment(workingDir, relPath)
        .then((src) =>
          settle({
            id,
            request,
            thumbnail: src === '' ? { status: 'failed' } : { status: 'ready', src },
          }),
        )
        .catch(() => settle({ id, request, thumbnail: { status: 'failed' } }));
    }
  }, [sources]);

  return thumbnails;
};
