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
    }
  | {
      readonly type: 'binary';
      readonly size: number;
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
  readonly editor?: string | null;
};

export const exploreOpen = async ({
  sessionDir,
  relPath,
  reveal,
  editor = null,
}: ExploreOpenParams): Promise<void> => {
  await invokeCommand('explore_open', { sessionDir, relPath, reveal, editor });
};
