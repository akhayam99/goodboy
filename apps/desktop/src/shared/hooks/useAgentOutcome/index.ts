import { useMemo } from 'react';
import { stripControlMarkers } from '@goodboy/core/context';
import { fallbackStepOutputSummary } from '@goodboy/core/summarizer';
import type { Agent } from '@goodboy/types';
import { useTranscript } from '../../../store/slices/transcripts/selectors';
import { reduceTranscript } from '../../../features/chat/utils/transcript-items';

export type AgentOutcome = {
  readonly text: string;
  readonly isFromReply: boolean;
  readonly raw: string;
};

const lastReplyOf = (items: ReturnType<typeof reduceTranscript>): string => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === 'assistant_text') {
      return item.text.trim();
    }
  }
  return '';
};

export const useAgentOutcome = ({ agent }: { readonly agent: Agent }): AgentOutcome => {
  const transcript = useTranscript(agent.id);
  const lastReply = useMemo(() => lastReplyOf(reduceTranscript(transcript)), [transcript]);
  const summary = agent.outputSummary?.trim() ?? '';
  const hasSummary = summary !== '';
  const raw = hasSummary
    ? summary
    : lastReply === ''
      ? ''
      : fallbackStepOutputSummary({ output: lastReply });
  return { text: stripControlMarkers(raw), isFromReply: !hasSummary && raw !== '', raw };
};
