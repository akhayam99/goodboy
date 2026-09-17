import {
  WIREFRAME_SCOUT_HEARSAY_RULE,
  WIREFRAME_SCOUT_LIMITS,
  WIREFRAME_SCOUT_NOTHING_USABLE,
  type WireframeScoutSectionEntry,
} from '../wireframes/wireframeScoutReports';

export type ArtifactScoutSectionKind = 'wireframe' | 'report';

export const REPORT_SCOUT_NOTHING_USABLE =
  'scouting produced nothing usable, so this report is written from the evidence below alone.';

export const REPORT_SCOUT_HEARSAY_RULE =
  'a claim whose only support is a missing path is hearsay: never a change, never a number, at most an open question. open a cited file before you report what changed in it.';

type OpeningParams = Readonly<{
  count: number;
  scope: string;
}>;

type SectionCopy = Readonly<{
  opening: (params: OpeningParams) => string;
  hearsayRule: string;
  nothingUsable: string;
}>;

const SECTION_COPY = {
  wireframe: {
    opening: ({ count, scope }: OpeningParams): string =>
      `${count} scouts read the mounted repository in parallel, one turn each, rooted at ${scope}.`,
    hearsayRule: WIREFRAME_SCOUT_HEARSAY_RULE,
    nothingUsable: WIREFRAME_SCOUT_NOTHING_USABLE,
  },
  report: {
    opening: ({ count, scope }: OpeningParams): string =>
      `${count} scouts read the diff of the repositories it touched in parallel, one turn each, in ${scope}.`,
    hearsayRule: REPORT_SCOUT_HEARSAY_RULE,
    nothingUsable: REPORT_SCOUT_NOTHING_USABLE,
  },
} satisfies Record<ArtifactScoutSectionKind, SectionCopy>;

const entryBlock = ({ entry }: Readonly<{ entry: WireframeScoutSectionEntry }>): string => {
  const lines = [`### ${entry.name}`];
  if (entry.header !== null) {
    lines.push(entry.header);
  }
  if (entry.body !== null) {
    lines.push(entry.body);
    return lines.join('\n\n');
  }
  lines.push(`this scout reported nothing usable: ${entry.note ?? 'no reason was recorded'}`);
  return lines.join('\n\n');
};

type SectionParams = Readonly<{
  kind: ArtifactScoutSectionKind;
  scope: string;
  entries: ReadonlyArray<WireframeScoutSectionEntry>;
}>;

export const artifactScoutSection = ({ kind, scope, entries }: SectionParams): string => {
  const copy = SECTION_COPY[kind];
  const usable = entries.filter((entry) => entry.body !== null);
  const head = [
    '## scout reports',
    copy.opening({ count: entries.length, scope }),
    copy.hearsayRule,
  ].join('\n\n');
  const blocks = entries.map((entry) => entryBlock({ entry }));
  if (usable.length === 0) {
    return [head, copy.nothingUsable, ...blocks]
      .join('\n\n')
      .slice(0, WIREFRAME_SCOUT_LIMITS.section);
  }
  return [head, ...blocks].join('\n\n').slice(0, WIREFRAME_SCOUT_LIMITS.section);
};
