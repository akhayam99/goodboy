import { invokeCommand } from '../../shared/lib/invokeCommand';

export type ExploreEntry = {
  readonly name: string;
  readonly relPath: string;
  readonly isDir: boolean;
  readonly sizeBytes: number;
  readonly modifiedAt: string | null;
};

export type ExploreContent =
  | {
      readonly type: 'text';
      readonly text: string;
      readonly truncated: boolean;
    }
  | {
      readonly type: 'dataUrl';
      readonly url: string;
    };

type ExploreListParams = {
  readonly sessionDir: string;
  readonly relPath: string;
};

export const exploreList = async ({
  sessionDir,
  relPath,
}: ExploreListParams): Promise<ReadonlyArray<ExploreEntry>> => {
  return invokeCommand<ReadonlyArray<ExploreEntry>>('explore_list', { sessionDir, relPath });
};

type ExploreReadParams = {
  readonly sessionDir: string;
  readonly relPath: string;
};

export const exploreRead = async ({
  sessionDir,
  relPath,
}: ExploreReadParams): Promise<ExploreContent> => {
  return invokeCommand<ExploreContent>('explore_read', { sessionDir, relPath });
};

type ExploreOpenParams = {
  readonly sessionDir: string;
  readonly relPath: string;
  readonly reveal: boolean;
};

export const exploreOpen = async ({
  sessionDir,
  relPath,
  reveal,
}: ExploreOpenParams): Promise<void> => {
  await invokeCommand('explore_open', { sessionDir, relPath, reveal });
};
