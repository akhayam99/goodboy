import { isScratchAttachment } from './isScratchAttachment';

type Params = {
  readonly relPath: string;
  readonly worktreeDir: string | null;
  readonly scratchDir: string | null;
};

export const attachmentDirOf = ({ relPath, worktreeDir, scratchDir }: Params): string | null =>
  isScratchAttachment({ relPath }) ? scratchDir : worktreeDir;
