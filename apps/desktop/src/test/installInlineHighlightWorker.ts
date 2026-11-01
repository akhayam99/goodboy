import { vi } from 'vitest';
import { tokenizeCode } from '../shared/lib/highlight/tokenize';
import type { HighlightRequest, HighlightResponse } from '../shared/lib/highlight/protocol';

class InlineHighlightWorker {
  onmessage: ((event: MessageEvent<HighlightResponse>) => void) | null = null;
  onerror: (() => void) | null = null;

  postMessage = (request: HighlightRequest) => {
    void tokenizeCode({ code: request.code, lang: request.lang }).then((lines) => {
      this.onmessage?.({ data: { id: request.id, lines } } as MessageEvent<HighlightResponse>);
    });
  };

  terminate = () => undefined;
}

export const installInlineHighlightWorker = () => {
  vi.stubGlobal('Worker', InlineHighlightWorker);
};
