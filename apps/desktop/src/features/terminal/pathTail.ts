const WORKTREE_TAIL = /[\\/][^\\/]+[\\/]\.goodboy[\\/]worktrees[\\/][^\\/]+$/;

const LAST_TWO = /[\\/][^\\/]+[\\/][^\\/]+$/;

type TailParams = {
  readonly path: string;
};

export const pathTail = ({ path }: TailParams): RegExp =>
  WORKTREE_TAIL.test(path) ? WORKTREE_TAIL : LAST_TWO;
