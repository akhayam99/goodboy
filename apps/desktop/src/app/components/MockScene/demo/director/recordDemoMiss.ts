const MISSES_KEY = '__goodboyDemoMisses';

export const DEMO_PARK: unique symbol = Symbol('demo-park');

type Params = {
  readonly entry: string;
};

export const recordDemoMiss = ({ entry }: Params): typeof DEMO_PARK => {
  const current: unknown = Reflect.get(window, MISSES_KEY);
  const list: Array<unknown> = Array.isArray(current) ? current : [];
  if (!list.includes(entry)) {
    list.push(entry);
  }
  Reflect.set(window, MISSES_KEY, list);
  return DEMO_PARK;
};
