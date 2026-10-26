import type { Agent, TurnEvent } from '@goodboy/types';

type Params = Readonly<{
  agents: ReadonlyArray<Pick<Agent, 'id' | 'name'>>;
  transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
}>;

export const turnWritersOf = ({
  agents,
  transcripts,
}: Params): Readonly<Record<string, string>> => {
  const writers: Record<string, string> = {};
  for (const agent of agents) {
    for (const event of transcripts[agent.id] ?? []) {
      if (event.kind === 'user_text' && writers[event.runId] === undefined) {
        writers[event.runId] = agent.name;
      }
    }
  }
  return writers;
};
