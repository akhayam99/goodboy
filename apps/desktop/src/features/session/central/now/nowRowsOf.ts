import type { Work } from '../../../live-state/workOf';
import type { LiveGroupModel } from './liveGroupsOf';

export const NOW_LIMIT = 3;

export type NowRow = Readonly<{
  agentId: string;
  depth: 0 | 1;
  who: string;
  place: string | null;
  phrase: string;
  startedAt: number | null;
}>;

export type NowWait = Readonly<{
  id: string;
  text: string;
  isHot: boolean;
  since: number | null;
}>;

export type NowWriterWait = Readonly<{
  agentId: string;
  path: string;
  blockedBy: string | null;
  since: number | null;
}>;

export type NowModel = Readonly<{
  shown: ReadonlyArray<NowRow>;
  moreCount: number;
  rows: ReadonlyArray<NowRow>;
  waits: ReadonlyArray<NowWait>;
}>;

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly work: ReadonlyArray<Work>;
  readonly writerWaits: ReadonlyArray<NowWriterWait>;
  readonly nounById: ReadonlyMap<string, string>;
};

type Member = Readonly<{
  agentId: string;
  who: string;
}>;

type Family = Readonly<{
  id: string;
  root: Member | null;
  children: ReadonlyArray<Member>;
}>;

type GroupParams = {
  readonly group: LiveGroupModel;
};

const LEAD = 'Lead';

const nowFamilyOf = ({ group }: GroupParams): Family => {
  switch (group.kind) {
    case 'auto':
      return {
        id: group.id,
        root: { agentId: group.group.rootAgentId, who: LEAD },
        children: group.children.map((child) => ({ agentId: child.agentId, who: child.noun })),
      };
    case 'agent':
      return {
        id: group.id,
        root: { agentId: group.entry.agent.id, who: group.title },
        children: group.children.map((child) => ({ agentId: child.agentId, who: child.title })),
      };
    case 'run':
    case 'orchestrated':
      return {
        id: group.id,
        root: null,
        children: group.children.map((child) => ({ agentId: child.agentId, who: child.title })),
      };
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
};

type RowParams = {
  readonly member: Member;
  readonly work: Work;
  readonly depth: 0 | 1;
};

const nowRowOf = ({ member, work, depth }: RowParams): NowRow => ({
  agentId: member.agentId,
  depth,
  who: member.who,
  place: work.place.kind === 'project' ? work.place.name : null,
  phrase: work.phrase,
  startedAt: work.startedAt,
});

type WaitParams = {
  readonly wait: NowWriterWait;
  readonly nounById: ReadonlyMap<string, string>;
};

const writerWaitOf = ({ wait, nounById }: WaitParams): NowWait => {
  const who = nounById.get(wait.agentId) ?? 'An agent';
  const holder = wait.blockedBy === null ? undefined : nounById.get(wait.blockedBy);
  const held = holder === undefined ? '' : `, held by the ${holder}`;
  return {
    id: `writer:${wait.agentId}`,
    text: `${who} waits on ${wait.path}${held}`,
    isHot: true,
    since: wait.since,
  };
};

export const nowRowsOf = ({ groups, work, writerWaits, nounById }: Params): NowModel => {
  const waiting = new Set(writerWaits.map((wait) => wait.agentId));
  const workByAgent = new Map(
    work.flatMap((entry) =>
      entry.agentId === null || waiting.has(entry.agentId) ? [] : [[entry.agentId, entry] as const],
    ),
  );
  const placed = new Set<string>(waiting);
  const rows: Array<NowRow> = [];
  const waits: Array<NowWait> = [];
  for (const group of groups) {
    const family = nowFamilyOf({ group });
    const rootWork = family.root === null ? undefined : workByAgent.get(family.root.agentId);
    if (family.root !== null && rootWork !== undefined) {
      rows.push(nowRowOf({ member: family.root, work: rootWork, depth: 0 }));
      placed.add(family.root.agentId);
    }
    const depth = family.root === null ? 0 : 1;
    const busy = family.children.filter(
      (child) => workByAgent.has(child.agentId) && !placed.has(child.agentId),
    );
    for (const child of busy) {
      const childWork = workByAgent.get(child.agentId);
      if (childWork === undefined) {
        continue;
      }
      if (placed.has(child.agentId)) {
        continue;
      }
      rows.push(nowRowOf({ member: child, work: childWork, depth }));
      placed.add(child.agentId);
    }
    const first = busy[0];
    if (family.root !== null && rootWork === undefined && first !== undefined) {
      waits.push({
        id: `lead:${family.id}`,
        text: `${family.root.who} waits on the ${first.who}`,
        isHot: false,
        since: null,
      });
    }
  }
  for (const entry of work) {
    if (entry.agentId === null || placed.has(entry.agentId)) {
      continue;
    }
    rows.push(
      nowRowOf({
        member: { agentId: entry.agentId, who: nounById.get(entry.agentId) ?? 'An agent' },
        work: entry,
        depth: 0,
      }),
    );
  }
  const shown = rows.slice(0, NOW_LIMIT);
  return {
    shown,
    moreCount: rows.length - shown.length,
    rows,
    waits: [...writerWaits.map((wait) => writerWaitOf({ wait, nounById })), ...waits],
  };
};
