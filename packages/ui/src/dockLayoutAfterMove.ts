import { dockColumnsAfterMove } from './dockColumnsAfterMove';
import { dockGroupLeadOf } from './dockGroupLeadOf';
import type { DockMoveTarget, DockMoveUnit } from './dockMoveTarget';

type Columns = ReadonlyArray<ReadonlyArray<string>>;

export type DockGroups = Readonly<Record<string, ReadonlyArray<string>>>;

export type DockLayout = {
  readonly columns: Columns;
  readonly groups: DockGroups;
};

type Params = DockLayout & {
  readonly key: string;
  readonly unit: DockMoveUnit;
  readonly target: DockMoveTarget;
};

type AtParams = {
  readonly at: string;
};

type WithParams = {
  readonly groups: DockGroups;
  readonly lead: string;
  readonly keys: ReadonlyArray<string>;
};

type WithoutParams = {
  readonly groups: DockGroups;
  readonly lead: string;
};

const groupsWith = ({ groups, lead, keys }: WithParams): DockGroups => ({
  ...groups,
  [lead]: keys,
});

const groupsWithout = ({ groups, lead }: WithoutParams): DockGroups =>
  Object.fromEntries(Object.entries(groups).filter(([known]) => known !== lead));

const layoutShapeOf = ({ columns, groups }: DockLayout): string =>
  JSON.stringify({ columns, groups });

type ChangedParams = {
  readonly before: DockLayout;
  readonly after: DockLayout;
};

const changed = ({ before, after }: ChangedParams): DockLayout | null =>
  layoutShapeOf(before) === layoutShapeOf(after) ? null : after;

const cellMoveOf = ({ columns, groups, key, target }: Params): DockLayout | null => {
  const cell = dockGroupLeadOf({ groups, key }) ?? key;
  const moved = dockColumnsAfterMove({ columns, key: cell, target });
  if (moved === null) {
    return null;
  }
  if (target.at !== 'tab') {
    return { columns: moved, groups };
  }
  const own = groups[cell] ?? [cell];
  const kept = groupsWithout({ groups, lead: cell });
  return {
    columns: moved,
    groups: groupsWith({
      groups: kept,
      lead: target.key,
      keys: [...(kept[target.key] ?? [target.key]), ...own],
    }),
  };
};

type TearParams = Params & {
  readonly lead: string;
};

const tearOutOf = ({ columns, groups, key, target, lead }: TearParams): DockLayout | null => {
  const group = groups[lead] ?? [];
  const remaining = group.filter((candidate) => candidate !== key);
  const nextLead = key === lead ? remaining[0] : lead;
  if (nextLead === undefined || target.at === 'swap') {
    return null;
  }
  const relead = ({ at }: AtParams): string => (key === lead && at === lead ? nextLead : at);
  const rekeyed = columns.map((column) => column.map((at) => relead({ at })));
  const trimmed = groupsWithout({ groups, lead });
  const kept =
    remaining.length > 1
      ? groupsWith({ groups: trimmed, lead: nextLead, keys: remaining })
      : trimmed;
  if (target.at === 'tab') {
    const into = relead({ at: target.key });
    if (into === nextLead || !rekeyed.some((column) => column.includes(into))) {
      return null;
    }
    return {
      columns: rekeyed,
      groups: groupsWith({ groups: kept, lead: into, keys: [...(kept[into] ?? [into]), key] }),
    };
  }
  const retargeted = target.at === 'page' ? target : { ...target, key: relead({ at: target.key }) };
  const moved = dockColumnsAfterMove({
    columns: rekeyed,
    key,
    target: retargeted,
    isDetached: true,
  });
  return moved === null ? null : { columns: moved, groups: kept };
};

export const dockLayoutAfterMove = ({
  columns,
  groups,
  key,
  unit,
  target,
}: Params): DockLayout | null => {
  const lead = dockGroupLeadOf({ groups, key });
  const params = { columns, groups, key, unit, target };
  const after =
    unit === 'panel' && lead !== null ? tearOutOf({ ...params, lead }) : cellMoveOf(params);
  return after === null ? null : changed({ before: { columns, groups }, after });
};
