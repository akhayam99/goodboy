import { tokenizeCode } from './tokenize';
import type { HighlightRequest, HighlightResponse } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HighlightRequest>) => void) | null;
  postMessage: (message: HighlightResponse) => void;
};

scope.onmessage = (event) => {
  const { id, code, lang } = event.data;
  void tokenizeCode({ code, lang }).then((lines) => scope.postMessage({ id, lines }));
};
