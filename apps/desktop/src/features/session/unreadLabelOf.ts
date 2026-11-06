import type { Agent } from '@goodboy/types';
import { plainText } from '../../shared/utils/plainText';
import { firstSentenceOf } from './central/done/firstSentenceOf';

type Params = {
  readonly unread: ReadonlyArray<Agent>;
};

type AgentParams = {
  readonly agent: Agent;
};

const MAX_TITLE_CHARS = 80;

const unreadTitleOf = ({ agent }: AgentParams): string => {
  const sentence = firstSentenceOf({ text: agent.outputSummary });
  const plain = sentence === null ? '' : plainText({ text: sentence });
  const title = plain === '' ? agent.name : plain;
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
