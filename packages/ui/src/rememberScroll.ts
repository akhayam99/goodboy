import { SCROLL_MEMORY, SCROLL_MEMORY_CAP } from './scrollMemoryStore';

type Params = {
  readonly memoryKey: string;
  readonly top: number;
};

export const rememberScroll = ({ memoryKey, top }: Params): void => {
  SCROLL_MEMORY.delete(memoryKey);
  SCROLL_MEMORY.set(memoryKey, top);
  while (SCROLL_MEMORY.size > SCROLL_MEMORY_CAP) {
    const oldest = SCROLL_MEMORY.keys().next();
    if (oldest.done === true) {
      return;
    }
    SCROLL_MEMORY.delete(oldest.value);
  }
};
