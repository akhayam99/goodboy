const TREE_BASE_PX = 8;

export const TREE_INDENT_PX = 12;

type IndentParams = {
  readonly depth: number;
};

export const treeIndentPx = ({ depth }: IndentParams): number =>
  TREE_BASE_PX + depth * TREE_INDENT_PX;
