import { extractCommentResolved } from '@goodboy/core';
import type { ProviderRunId, TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

export const resolverReportedShas = ({ events }: Params): ReadonlyArray<string> => {
  const textByRun = new Map<ProviderRunId, string>();
  for (const event of events) {
    if (event.kind !== 'assistant_text') {
      continue;
    }
    textByRun.set(event.runId, `${textByRun.get(event.runId) ?? ''}${event.delta}`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of textByRun.values()) {
    const marker = extractCommentResolved(text);
    if (marker === null || seen.has(marker.commitSha)) {
      continue;
    }
    seen.add(marker.commitSha);
    out.push(marker.commitSha);
  }
  return out;
};
