import type { Agent } from '@goodboy/types';
import type { CommandRow, CommandSection } from '../commandList';
import type { PaletteEntry, PaletteScope } from '../types';

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

const LIVE_KEY_SUFFIX = ':live';

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
        key: `${entry.key}${LIVE_KEY_SUFFIX}`,
        label: `${verb} ${name}`,
        secondary: [...(entry.secondary ?? []), entry.label],
        isScopeVerb: true,
      },
    ];
  });

type OwnFirstParams = {
  readonly scopeKind: PaletteScope['kind'] | null;
  readonly isIdle: boolean;
  readonly sections: ReadonlyArray<CommandSection>;
};

const isLiveRow = (row: CommandRow): boolean => row.item.key.endsWith(LIVE_KEY_SUFFIX);

const ownFirst = (rows: ReadonlyArray<CommandRow>): ReadonlyArray<CommandRow> => {
  const at = rows.findIndex((row) => !isLiveRow(row));
  const own = rows[at];
  return at <= 0 || own === undefined ? rows : [own, ...rows.slice(0, at), ...rows.slice(at + 1)];
};

export const sessionOwnFirst = ({
  scopeKind,
  isIdle,
  sections,
}: OwnFirstParams): ReadonlyArray<CommandSection> => {
  if (scopeKind !== 'session' || !isIdle) {
    return sections;
  }
  const at = sections.findIndex((section) => section.rows.some(isLiveRow));
  const section = sections[at];
  return at !== 0 || section === undefined
    ? sections
    : [{ ...section, rows: ownFirst(section.rows) }, ...sections.slice(1)];
};
