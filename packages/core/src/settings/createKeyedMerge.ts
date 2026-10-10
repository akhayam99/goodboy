export type KeyedLayer<V> = Readonly<Record<string, V | undefined>>;

export type KeyedMerged<V> = Readonly<Record<string, V>>;

type MergeParams<V> = {
  readonly layers: ReadonlyArray<KeyedLayer<V> | null | undefined>;
};

type CacheNode<V> = {
  readonly children: WeakMap<object, CacheNode<V>>;
  result: KeyedMerged<V> | undefined;
};

const newNode = <V>(): CacheNode<V> => ({ children: new WeakMap(), result: undefined });

export const createKeyedMerge = <V extends object>() => {
  const root = newNode<V>();
  return ({ layers }: MergeParams<V>): KeyedMerged<V> | null => {
    const filled = layers.filter(
      (layer): layer is KeyedLayer<V> => layer != null && Object.keys(layer).length > 0,
    );
    if (filled.length === 0) {
      return null;
    }
    const [whole] = filled.filter((layer): layer is KeyedMerged<V> =>
      Object.values(layer).every((value) => value !== undefined),
    );
    if (filled.length === 1 && whole !== undefined) {
      return whole;
    }
    const node = filled.reduce<CacheNode<V>>((current, layer) => {
      const child = current.children.get(layer) ?? newNode<V>();
      current.children.set(layer, child);
      return child;
    }, root);
    node.result ??= Object.fromEntries(
      filled
        .flatMap((layer) => Object.entries(layer))
        .flatMap(([key, value]) => (value === undefined ? [] : [[key, value] as const])),
    );
    return Object.keys(node.result).length > 0 ? node.result : null;
  };
};
