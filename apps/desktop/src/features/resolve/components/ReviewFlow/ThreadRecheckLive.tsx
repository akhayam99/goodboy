import { useMemo } from 'react';
import { stripControlMarkers } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { RECHECK_LABEL } from '../../reviewFlowCopy';

type LiveProps = { readonly agentId: AgentId };

const lastLineOf = ({ text }: { readonly text: string }): string =>
  stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

export const ThreadRecheckLive = ({ agentId }: LiveProps) => {
  const transcript = useTranscript(agentId);
  const live = useMemo(() => {
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return lastLineOf({ text: item.text });
      }
    }
    return '';
  }, [transcript]);
  return (
    <p
      aria-live="polite"
      className="min-w-0 truncate pl-7 text-meta text-muted-foreground motion-safe:animate-studio-in"
    >
      {live === '' ? RECHECK_LABEL.looking : live}
    </p>
  );
};
