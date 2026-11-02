import { SCROLL_MEMORY } from './scrollMemoryStore';

type Params = {
  readonly scopeId: string;
};

export const forgetScrollMemory = ({ scopeId }: Params): void => {
  const marker = `${scopeId}|`;
  for (const memoryKey of [...SCROLL_MEMORY.keys()]) {
    if (memoryKey.startsWith(marker)) {
      SCROLL_MEMORY.delete(memoryKey);
    }
  }
};
