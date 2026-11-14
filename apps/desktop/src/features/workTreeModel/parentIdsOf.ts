type Node = Readonly<{
  id: string;
  level: number;
}>;

type Params = {
  readonly nodes: ReadonlyArray<Node>;
};

export const parentIdsOf = ({ nodes }: Params): ReadonlyMap<string, string | null> => {
  const parentById = new Map<string, string | null>();
  const stack: Node[] = [];
  for (const node of nodes) {
    while ((stack.at(-1)?.level ?? 0) >= node.level) {
      stack.pop();
    }
    parentById.set(node.id, stack.at(-1)?.id ?? null);
    stack.push(node);
  }
  return parentById;
};
