export type TrackedRead<U> = {
  readonly value: U;
  readonly keys: ReadonlySet<PropertyKey> | null;
};

type RunTrackedParams<S extends object, U> = {
  readonly selector: (state: S) => U;
  readonly state: S;
};

type TrapParams = {
  readonly keys: Set<PropertyKey>;
};

const readTrap =
  ({ keys }: TrapParams) =>
  (target: object, key: PropertyKey): unknown => {
    keys.add(key);
    return Reflect.get(target, key);
  };

type OpaqueTrapParams = {
  readonly onOpaque: () => void;
};

const hasTrap =
  ({ onOpaque }: OpaqueTrapParams) =>
  (target: object, key: PropertyKey): boolean => {
    onOpaque();
    return Reflect.has(target, key);
  };

const ownKeysTrap =
  ({ onOpaque }: OpaqueTrapParams) =>
  (target: object): ArrayLike<string | symbol> => {
    onOpaque();
    return Reflect.ownKeys(target);
  };

const descriptorTrap =
  ({ onOpaque }: OpaqueTrapParams) =>
  (target: object, key: PropertyKey): PropertyDescriptor | undefined => {
    onOpaque();
    return Reflect.getOwnPropertyDescriptor(target, key);
  };

export const runTracked = <S extends object, U>({
  selector,
  state,
}: RunTrackedParams<S, U>): TrackedRead<U> => {
  const keys = new Set<PropertyKey>();
  let isOpaque = false;
  const onOpaque = (): void => {
    isOpaque = true;
  };
  const view = new Proxy<S>(state, {
    get: readTrap({ keys }),
    has: hasTrap({ onOpaque }),
    ownKeys: ownKeysTrap({ onOpaque }),
    getOwnPropertyDescriptor: descriptorTrap({ onOpaque }),
  });
  const result = selector(view);
  if (Object.is(result, view)) {
    return { value: selector(state), keys: null };
  }
  return { value: result, keys: isOpaque ? null : keys };
};
