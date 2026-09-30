import type { AgentId, SessionId } from '@goodboy/types';
import { reduceTranscript } from '../../../features/chat/utils/transcript-items';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'sessionPhaseRuns' | 'transcripts'>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type SourceOutput = {
  readonly name: string;
  readonly output: string;
};

export const handoffSourceOutput = ({ state, sessionId, agentId }: Params): SourceOutput => {
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  const name = agent?.name ?? 'the previous agent';
  const summary = agent?.outputSummary?.trim() ?? '';
  if (summary !== '') {
    return { name, output: summary };
  }
  const items = reduceTranscript(state.transcripts[agentId] ?? []);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.kind === 'assistant_text') {
      return { name, output: item.text };
    }
  }
  return { name, output: '' };
};
