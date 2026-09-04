export const MAX_CACHE_CHUNKS = 500;

export const outputCache = new Map<string, Uint8Array[]>();

export const clearTerminalCache = (terminalId: string): void => {
  outputCache.delete(terminalId);
};
