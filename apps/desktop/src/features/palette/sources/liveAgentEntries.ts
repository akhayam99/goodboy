import type { Agent } from '@goodboy/types';
import type { PaletteEntry } from '../types';

type Params = {
  readonly verbs: ReadonlyArray<PaletteEntry>;
  readonly name: string;
};

type LiveAgentParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly selectedAgentId: string | null;
  readonly isTurnRunning: (agent: Agent) => boolean;
};

export const pickLiveAgent = ({
  agents,
  selectedAgentId,
  isTurnRunning,
}: LiveAgentParams): Agent | null => {
  const running = agents.filter((agent) => agent.deletedAt == null && isTurnRunning(agent));
  return running.find((agent) => agent.id === selectedAgentId) ?? running[0] ?? null;
};

const LIVE_VERBS: Readonly<Record<string, string>> = {
  'agent.message': 'Message',
  'agent.interrupt': 'Interrupt',
};

export const liveAgentVerbs = ({ verbs, name }: Params): ReadonlyArray<PaletteEntry> =>
  verbs.flatMap((entry): ReadonlyArray<PaletteEntry> => {
    const actionId = entry.action?.id ?? '';
    const verb = LIVE_VERBS[actionId];
    if (verb === undefined) {
      return [];
    }
    return [
      {
        ...entry,
        key: `${entry.key}:live`,
        label: `${verb} ${name}`,
        secondary: [...(entry.secondary ?? []), entry.label],
        isScopeVerb: true,
      },
    ];
  });
