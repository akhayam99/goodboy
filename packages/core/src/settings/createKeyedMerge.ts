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

const isComplete = <V>(layer: KeyedLayer<V>): layer is KeyedMerged<V> =>
  Object.values(layer).every((value) => value !== undefined);

const isFilled = <V>(layer: KeyedLayer<V> | null | undefined): layer is KeyedLayer<V> =>
  layer != null && Object.keys(layer).length > 0;

const combine = <V>(layers: ReadonlyArray<KeyedLayer<V>>): KeyedMerged<V> =>
  Object.fromEntries(
    layers
      .flatMap((layer) => Object.entries(layer))
      .flatMap(([key, value]) => (value === undefined ? [] : [[key, value] as const])),
  );

export const createKeyedMerge = <V extends object>() => {
  const root = newNode<V>();
  return ({ layers }: MergeParams<V>): KeyedMerged<V> | null => {
    const filled = layers.filter(isFilled);
    const [first] = filled;
    if (first === undefined) {
      return null;
    }
    if (filled.length === 1 && isComplete(first)) {
      return first;
    }
    const node = filled.reduce<CacheNode<V>>((current, layer) => {
      const child = current.children.get(layer) ?? newNode<V>();
      current.children.set(layer, child);
      return child;
    }, root);
    node.result ??= combine(filled);
    return Object.keys(node.result).length > 0 ? node.result : null;
  };
};
