export type StageRead = {
  readonly key: PropertyKey;
  value: unknown;
  readonly subKeys: ReadonlyArray<PropertyKey> | null;
  readonly subValues: ReadonlyArray<unknown>;
};

export type StageReads = ReadonlyArray<StageRead>;

type Recording = {
  readonly values: Map<PropertyKey, unknown>;
  readonly wholeKeys: Set<PropertyKey>;
  readonly subReads: Map<PropertyKey, Map<PropertyKey, unknown>>;
  readonly views: Map<PropertyKey, object>;
  isOpaque: boolean;
};

type RecordParams = {
  readonly value: unknown;
};

const plainRecordOf = ({ value }: RecordParams): object | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : null;
};

type SubReadTrapParams = {
  readonly record: object;
  readonly reads: Map<PropertyKey, unknown>;
};

const subReadTrap =
  ({ record, reads }: SubReadTrapParams) =>
  (_target: object, subKey: PropertyKey): unknown => {
    const value: unknown = Reflect.get(record, subKey);
    reads.set(subKey, value);
    return value;
  };

type WholeTrapParams = {
  readonly record: object;
  readonly onWhole: () => void;
};

const wholeHasTrap =
  ({ record, onWhole }: WholeTrapParams) =>
  (_target: object, subKey: PropertyKey): boolean => {
    onWhole();
    return Reflect.has(record, subKey);
  };

const wholeKeysTrap =
  ({ record, onWhole }: WholeTrapParams) =>
  (): ArrayLike<string | symbol> => {
    onWhole();
    return Reflect.ownKeys(record);
  };

const wholeDescriptorTrap =
  ({ record, onWhole }: WholeTrapParams) =>
  (_target: object, subKey: PropertyKey): PropertyDescriptor | undefined => {
    onWhole();
    return Reflect.getOwnPropertyDescriptor(record, subKey);
  };

type SubViewParams = {
  readonly recording: Recording;
  readonly key: PropertyKey;
  readonly record: object;
};

const subViewOf = ({ recording, key, record }: SubViewParams): object => {
  const known = recording.views.get(key);
  if (known !== undefined) {
    return known;
  }
  const reads = new Map<PropertyKey, unknown>();
  recording.subReads.set(key, reads);
  const onWhole = (): void => {
    recording.wholeKeys.add(key);
  };
  const view = new Proxy(
    {},
    {
      get: subReadTrap({ record, reads }),
      has: wholeHasTrap({ record, onWhole }),
      ownKeys: wholeKeysTrap({ record, onWhole }),
      getOwnPropertyDescriptor: wholeDescriptorTrap({ record, onWhole }),
    },
  );
  recording.views.set(key, view);
  return view;
};

type StateTrapParams = {
  readonly recording: Recording;
  readonly state: object;
};

const stateReadTrap =
  ({ recording, state }: StateTrapParams) =>
  (_target: object, key: PropertyKey): unknown => {
    const value: unknown = Reflect.get(state, key);
    recording.values.set(key, value);
    const record = plainRecordOf({ value });
    if (record === null) {
      recording.wholeKeys.add(key);
      return value;
    }
    return subViewOf({ recording, key, record });
  };

const stateHasTrap =
  ({ recording, state }: StateTrapParams) =>
  (_target: object, key: PropertyKey): boolean => {
    recording.values.set(key, Reflect.get(state, key));
    recording.wholeKeys.add(key);
    return Reflect.has(state, key);
  };

const opaqueTrapsOf = ({ recording, state }: StateTrapParams) => {
  const onWhole = (): void => {
    recording.isOpaque = true;
  };
  return {
    ownKeys: wholeKeysTrap({ record: state, onWhole }),
    getOwnPropertyDescriptor: wholeDescriptorTrap({ record: state, onWhole }),
  };
};

type ReadsParams = {
  readonly recording: Recording;
};

const readsOf = ({ recording }: ReadsParams): StageReads =>
  [...recording.values].map(([key, value]) => {
    const subReads = recording.subReads.get(key);
    if (recording.wholeKeys.has(key) || subReads === undefined) {
      return { key, value, subKeys: null, subValues: [] };
    }
    return { key, value, subKeys: [...subReads.keys()], subValues: [...subReads.values()] };
  });

type DeriveParams<S extends object> = {
  readonly view: S;
};

type Params<S extends object, T> = {
  readonly state: S;
  readonly derive: ({ view }: DeriveParams<S>) => T;
};

type Recorded<T> = {
  readonly value: T;
  readonly reads: StageReads | null;
};

export const recordStageReads = <S extends object, T>({
  state,
  derive,
}: Params<S, T>): Recorded<T> => {
  const recording: Recording = {
    values: new Map(),
    wholeKeys: new Set(),
    subReads: new Map(),
    views: new Map(),
    isOpaque: false,
  };
  const placeholder: S = Object.create(null);
  const view = new Proxy<S>(placeholder, {
    get: stateReadTrap({ recording, state }),
    has: stateHasTrap({ recording, state }),
    ...opaqueTrapsOf({ recording, state }),
  });
  const value = derive({ view });
  return { value, reads: recording.isOpaque ? null : readsOf({ recording }) };
};
