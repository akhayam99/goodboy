import type { AgentId } from '@goodboy/types';
import type { AskHandle } from './askHandles';
import { parseAskAnswer, type AskBlock } from './parseAskAnswer';

type AskLineReply = Readonly<{
  text: string;
  sources: ReadonlyArray<string>;
  agentId: AgentId | null;
}>;

type Params = Readonly<{
  content: string;
  handles: ReadonlyArray<AskHandle>;
}>;

type BlockParams = Readonly<{
  block: AskBlock;
}>;

const blockTextOf = ({ block }: BlockParams): string =>
  block.inlines
    .map((inline) => (inline.kind === 'text' ? inline.text : inline.handle.label))
    .join('');

export const askLineReplyOf = ({ content, handles }: Params): AskLineReply => {
  const parsed = parseAskAnswer({ text: content, handles });
  const agent = [...(parsed.suggestion === null ? [] : [parsed.suggestion.handle]), ...parsed.cited]
    .map((handle) => handle.target)
    .find((target) => target.kind === 'agent');
  return {
    text: parsed.blocks
      .map((block) => blockTextOf({ block }))
      .join(' ')
      .trim(),
    sources: [...new Set(parsed.cited.map((handle) => handle.label))],
    agentId: agent?.kind === 'agent' ? agent.agentId : null,
  };
};
