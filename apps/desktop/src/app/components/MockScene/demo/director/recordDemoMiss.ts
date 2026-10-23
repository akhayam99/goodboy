const MISSES_KEY = '__goodboyDemoMisses';

const PENDING: Promise<never> = new Promise<never>(() => undefined);

type Params = {
  readonly entry: string;
};

export const recordDemoMiss = ({ entry }: Params): Promise<never> => {
  const current: unknown = Reflect.get(window, MISSES_KEY);
  const list: Array<unknown> = Array.isArray(current) ? current : [];
  if (!list.includes(entry)) {
    list.push(entry);
  }
  Reflect.set(window, MISSES_KEY, list);
  return PENDING;
};
