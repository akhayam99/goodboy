import { vi } from 'vitest';
import type { HighlightRequest, HighlightResponse } from '../shared/lib/highlight/protocol';

class InlineHighlightWorker {
  onmessage: ((event: MessageEvent<HighlightResponse>) => void) | null = null;
  onerror: (() => void) | null = null;

  postMessage = (request: HighlightRequest) => {
    void import('../shared/lib/highlight/tokenize')
      .then(({ tokenizeCode }) => tokenizeCode({ code: request.code, lang: request.lang }))
      .then((lines) => {
        this.onmessage?.(
          new MessageEvent<HighlightResponse>('message', { data: { id: request.id, lines } }),
        );
      });
  };

  terminate = () => undefined;
}

export const installInlineHighlightWorker = () => {
  vi.stubGlobal('Worker', InlineHighlightWorker);
};
