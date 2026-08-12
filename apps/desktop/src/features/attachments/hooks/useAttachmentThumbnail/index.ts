import { useEffect, useState } from 'react';
import { readAttachment } from '../../../chat/turn';
import type { AttachmentThumbnail } from '../../components/AttachmentChip';

type Params = {
  readonly kind: string;
  readonly relPath: string;
  readonly workingDir: string | null;
};

export const useAttachmentThumbnail = ({
  kind,
  relPath,
  workingDir,
}: Params): AttachmentThumbnail => {
  const [thumbnail, setThumbnail] = useState<AttachmentThumbnail>({ status: 'loading' });

  useEffect(() => {
    if (kind !== 'image') {
      return;
    }
    if (!workingDir) {
      setThumbnail({ status: 'failed' });
      return;
    }
    let alive = true;
    setThumbnail({ status: 'loading' });
    readAttachment(workingDir, relPath)
      .then((src) => {
        if (alive) setThumbnail({ status: 'ready', src });
      })
      .catch(() => {
        if (alive) setThumbnail({ status: 'failed' });
      });
    return () => {
      alive = false;
    };
  }, [workingDir, kind, relPath]);

  return thumbnail;
};
