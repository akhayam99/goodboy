import type { AgentId } from '@goodboy/types';

export type AskSessionAnswer = Readonly<{
  text: string;
  sources: ReadonlyArray<string>;
  agentId: AgentId | null;
}>;
