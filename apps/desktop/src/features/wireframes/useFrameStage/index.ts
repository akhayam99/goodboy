import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ArtifactFolderFile } from '../../artifacts/artifactFile';
import { releaseFrame, stageFrame } from '../frame/frameInvoke';

export type FrameStage =
  | Readonly<{ status: 'staging' }>
  | Readonly<{ status: 'ready'; stageId: string }>
  | Readonly<{ status: 'failed'; message: string }>;

type Params = {
  readonly files: ReadonlyArray<ArtifactFolderFile> | null;
};

export const useFrameStage = ({ files }: Params): FrameStage => {
  const [stage, setStage] = useState<FrameStage>({ status: 'staging' });

  useEffect(() => {
    if (files === null) {
      setStage({ status: 'staging' });
      return;
    }
    let isActive = true;
    let staged: string | null = null;
    stageFrame({ files })
      .then((stageId) => {
        staged = stageId;
        if (!isActive) {
          void releaseFrame({ stageId }).catch(() => undefined);
          return;
        }
        setStage({ status: 'ready', stageId });
      })
      .catch((cause: unknown) => {
        if (isActive) {
          setStage({ status: 'failed', message: formatError(cause) });
        }
      });
    return () => {
      isActive = false;
      if (staged !== null) {
        void releaseFrame({ stageId: staged }).catch(() => undefined);
      }
    };
  }, [files]);

  return stage;
};
