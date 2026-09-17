export const ARTIFACT_SCOUT_ROLE_IDS = ['screens', 'data', 'design', 'diff-context'] as const;

export type ArtifactScoutRoleId = (typeof ARTIFACT_SCOUT_ROLE_IDS)[number];

export type ArtifactScoutRole = Readonly<{
  id: ArtifactScoutRoleId;
  name: string;
  scope: string;
}>;

export const MERGED_SCOUT_ROLE_ID = 'sweep';

export const MERGED_SCOUT_NAME = 'repository sweep';

export const MOBILE_SCREENS_SENTENCE =
  'this one is drawn for a phone, so say where each screen puts its primary navigation, a bottom bar or a drawer, and at which width the layout it uses today collapses to a single column.';

export const ARTIFACT_SCOUT_ROLES = {
  screens: {
    id: 'screens',
    name: 'screens and routes',
    scope:
      'the routes, panes and screens nearest what the goal names. for each one say which file it is, what it already shows, and the component vocabulary it uses. while you are already in those files, answer whether a near neighbour of this feature exists and what it looked like. never walk the repository a second time for prior art.',
  },
  data: {
    id: 'data',
    name: 'data and contracts',
    scope:
      'the types, store slices, queries and api shapes behind those screens, down to the field names the ui can honestly render. say which field is optional and which is always present.',
  },
  design: {
    id: 'design',
    name: 'component vocabulary',
    scope:
      'the components a screen here is built from: the names the component library exports, the variants and sizes each one offers, and which of them the screens nearest the goal already use. the app has already read the token and theme files and hands the palette to the producer, so never reopen them and never report a colour, a radius or a spacing value.',
  },
  'diff-context': {
    id: 'diff-context',
    name: 'diff context',
    scope:
      'for every path the diff touches: the enclosing function or component as it reads now, the nearest test that exercises that path, and the nearest readme or docs section that describes the behaviour. say what a caller sees differently, whether a test covers the change, and whether any document has gone stale. the pack already carries the hunks and the commit subjects, so never restate them.',
  },
} satisfies Readonly<Record<ArtifactScoutRoleId, ArtifactScoutRole>>;
