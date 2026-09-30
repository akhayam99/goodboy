type Identified = { readonly id: string };

const positions = new WeakMap<ReadonlyArray<Identified>, ReadonlyMap<string, number>>();

const positionsOf = (items: ReadonlyArray<Identified>): ReadonlyMap<string, number> => {
  const cached = positions.get(items);
  if (cached) {
    return cached;
  }
  const built = new Map<string, number>();
  items.forEach((item, position) => {
    if (!built.has(item.id)) {
      built.set(item.id, position);
    }
  });
  positions.set(items, built);
  return built;
};

export const findById = <T extends Identified>(
  items: ReadonlyArray<T>,
  id: string | null | undefined,
): T | undefined => {
  if (id === null || id === undefined) {
    return undefined;
  }
  const position = positionsOf(items).get(id);
  return position === undefined ? undefined : items[position];
};
