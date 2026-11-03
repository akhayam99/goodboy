import { parseUnifiedDiff } from '@goodboy/core/github';
import type { ParseDiffRequest, ParseDiffResponse } from './parseDiffProtocol';

self.addEventListener('message', (event: MessageEvent<ParseDiffRequest>) => {
  const { id, raw } = event.data;
  try {
    const response: ParseDiffResponse = { id, files: parseUnifiedDiff(raw) };
    self.postMessage(response);
  } catch {
    const response: ParseDiffResponse = { id, files: null };
    self.postMessage(response);
  }
});
