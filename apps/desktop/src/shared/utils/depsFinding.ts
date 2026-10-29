import type { WorktreeDepsCheck } from '../lib/worktreeDepsCheck';

export type DepsFinding = {
  readonly title: string;
  readonly body: string;
  readonly command: string;
};

type Params = {
  readonly check: WorktreeDepsCheck | null;
};

const MISSING_TITLE = 'Dependencies are not installed in this worktree';
const OUTSIDE_TITLE = 'This worktree reads dependencies from another folder';

export const depsFindingOf = ({ check }: Params): DepsFinding | null => {
  if (check === null || check.command === null) {
    return null;
  }
  const { command } = check;
  const folder = check.folder ?? 'the install folder';
  if (check.state === 'missing') {
    return {
      title: MISSING_TITLE,
      body: `Checks and the push hook can fail until they are installed. Reinstalling runs "${command}" here.`,
      command,
    };
  }
  if (check.state !== 'outside') {
    return null;
  }
  if (check.isFolderLink) {
    return {
      title: OUTSIDE_TITLE,
      body: `${folder} is a link to another folder, so checks run against code that is not this branch's. Reinstalling removes only the link, never the folder it points to, then runs "${command}" here.`,
      command,
    };
  }
  const names = check.outside.join(', ');
  return {
    title: OUTSIDE_TITLE,
    body: `${names} link outside this worktree, so packages resolve to code that is not this branch's. Reinstalling runs "${command}" here to link them again.`,
    command,
  };
};
