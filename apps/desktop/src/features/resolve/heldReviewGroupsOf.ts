import { RESOLVE_LIST_GROUPS, type ResolveGroup } from './commentProjection';

type HeldPlace = {
  readonly group: ResolveGroup;
  readonly index: number;
};

export type HeldReviewPlaces = ReadonlyMap<string, HeldPlace>;

type HeldGroup<Entry> = {
  readonly group: ResolveGroup;
  readonly entries: ReadonlyArray<Entry>;
};

type Params<Entry> = {
  readonly held: HeldReviewPlaces;
  readonly groups: ReadonlyArray<HeldGroup<Entry>>;
};

type HeldReviewGroups<Entry> = {
  readonly held: HeldReviewPlaces;
  readonly groups: ReadonlyArray<HeldGroup<Entry>>;
};

export const heldReviewGroupsOf = <Entry extends { readonly threadId: string }>({
  held,
  groups,
}: Params<Entry>): HeldReviewGroups<Entry> => {
  const fresh = groups.flatMap(({ group, entries }) =>
    entries.filter((entry) => !held.has(entry.threadId)).map((entry) => ({ entry, group })),
  );
  const places =
    fresh.length === 0
      ? held
      : new Map([
          ...held,
          ...fresh.map(({ entry, group }, offset): [string, HeldPlace] => [
            entry.threadId,
            { group, index: held.size + offset },
          ]),
        ]);
  const entries = groups.flatMap((group) => group.entries);
  return {
    held: places,
    groups: RESOLVE_LIST_GROUPS.map((group) => ({
      group,
      entries: entries
        .filter((entry) => places.get(entry.threadId)?.group === group)
        .sort(
          (left, right) =>
            (places.get(left.threadId)?.index ?? 0) - (places.get(right.threadId)?.index ?? 0),
        ),
    })).filter((group) => group.entries.length > 0),
  };
};
