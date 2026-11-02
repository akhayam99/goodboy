import { SCROLL_MEMORY } from './scrollMemoryStore';

type Params = {
  readonly memoryKey: string;
};

export const recalledScroll = ({ memoryKey }: Params): number | null =>
  SCROLL_MEMORY.get(memoryKey) ?? null;
