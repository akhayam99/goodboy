import type { FactSlot, ResolvedFact } from '../../../detail-fields/factTypes';

type PropertyGroupName = 'Status' | 'Planning' | 'Links' | 'Details';

const GROUP_OF_SLOT = {
  state: 'Status',
  weight: 'Status',
  person: 'Status',
  place: 'Planning',
  labels: 'Planning',
  links: 'Links',
  measure: 'Details',
  time: 'Details',
} satisfies Record<FactSlot, PropertyGroupName>;

const GROUP_ORDER: ReadonlyArray<PropertyGroupName> = ['Status', 'Planning', 'Links', 'Details'];

export type PropertyRowFacts = {
  readonly key: string;
  readonly label: string;
  readonly facts: ReadonlyArray<ResolvedFact>;
};

export type PropertyGroup = {
  readonly name: PropertyGroupName;
  readonly rows: ReadonlyArray<PropertyRowFacts>;
};

type Params = {
  readonly facts: ReadonlyArray<ResolvedFact>;
};

export const propertyGroupsOf = ({ facts }: Params): ReadonlyArray<PropertyGroup> =>
  GROUP_ORDER.flatMap((name) => {
    const rows: Array<{ key: string; label: string; facts: ResolvedFact[] }> = [];
    for (const fact of facts) {
      if (GROUP_OF_SLOT[fact.slot] !== name) {
        continue;
      }
      const row = rows.find(
        (candidate) =>
          candidate.label === fact.label &&
          candidate.facts.every((held) => held.editor === undefined),
      );
      if (row !== undefined && fact.editor === undefined) {
        row.facts.push(fact);
        continue;
      }
      rows.push({ key: `${fact.slot}-${fact.key}`, label: fact.label, facts: [fact] });
    }
    return rows.length === 0 ? [] : [{ name, rows }];
  });
