import { attachmentDirOf } from './attachmentDirOf';

type Params = {
  readonly relPath: string;
  readonly worktreeDir: string | null;
  readonly scratchDir: string | null;
};

export const attachmentAbsolutePathOf = ({
  relPath,
  worktreeDir,
  scratchDir,
}: Params): string | null => {
  const dir = attachmentDirOf({ relPath, worktreeDir, scratchDir });
  if (dir == null) {
    return null;
  }
  return `${dir.endsWith('/') ? dir : `${dir}/`}${relPath}`;
};
