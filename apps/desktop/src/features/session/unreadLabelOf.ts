import type { Agent } from '@goodboy/types';
import { firstSentenceOf } from './central/done/firstSentenceOf';

type Params = {
  readonly unread: ReadonlyArray<Agent>;
};

type AgentParams = {
  readonly agent: Agent;
};

const MAX_TITLE_CHARS = 80;

const unreadTitleOf = ({ agent }: AgentParams): string => {
  const title = firstSentenceOf({ text: agent.outputSummary }) ?? agent.name;
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1)}…` : title;
};

export const unreadLabelOf = ({ unread }: Params): string | null => {
  const [newest, ...rest] = unread;
  if (newest === undefined) {
    return null;
  }
  const more = rest.length === 0 ? '' : `, and ${rest.length} more`;
  return `${unread.length} new: ${unreadTitleOf({ agent: newest })}${more}`;
};
