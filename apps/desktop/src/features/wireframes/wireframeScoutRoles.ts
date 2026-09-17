import { ARTIFACT_SCOUT_ROLES } from '../artifacts/artifactScoutRoles';
import { redactSecrets } from '../../shared/utils/redactSecrets';

export const WIREFRAME_SCOUT_IDS = ['screens', 'data'] as const;

export type WireframeScoutId = (typeof WIREFRAME_SCOUT_IDS)[number];

export type WireframeScout = Readonly<{
  id: string;
  name: string;
  scope: string;
}>;

export const WIREFRAME_SCOUTS: ReadonlyArray<WireframeScout> = WIREFRAME_SCOUT_IDS.map((id) => ({
  id,
  name: ARTIFACT_SCOUT_ROLES[id].name,
  scope: ARTIFACT_SCOUT_ROLES[id].scope,
}));

export const WIREFRAME_SCOUT_GOAL_LIMIT = 600;
export const WIREFRAME_SCOUT_BRIEF_LIMIT = 900;

const clip = ({ text, limit }: Readonly<{ text: string; limit: number }>): string => {
  const collapsed = text.trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit)}...`;
};

type KickoffParams = Readonly<{
  scout: WireframeScout;
  others: ReadonlyArray<WireframeScout>;
  root: string;
  goal: string;
  brief: string | null;
}>;

export const composeWireframeScoutKickoff = ({
  scout,
  others,
  root,
  goal,
  brief,
}: KickoffParams): string => {
  const trimmedBrief = brief === null ? '' : brief.trim();
  const otherScopes = others
    .map((entry) => `${entry.name} is reading ${entry.scope}`)
    .join(' ')
    .trim();
  return [
    `**Root** ${root}. read under this path. a trail that leaves it is worth one line saying where it went, never a second sweep.`,
    `**Scope** ${scout.scope}`,
    otherScopes.length === 0
      ? '**Not yours** nothing, you are the only scout on this wireframe.'
      : `**Not yours** ${otherScopes} do not read that ground, it is already covered.`,
    `**Goal** ${redactSecrets({ text: clip({ text: goal, limit: WIREFRAME_SCOUT_GOAL_LIMIT }) })}`,
    ...(trimmedBrief.length === 0
      ? []
      : [
          `**Brief** ${redactSecrets({ text: clip({ text: trimmedBrief, limit: WIREFRAME_SCOUT_BRIEF_LIMIT }) })}`,
        ]),
    '**Claims** every claim is one line that ends with a repo-relative path. a claim with no path is dropped without discussion, so cite the file you read it in.',
    '**Bound** one turn. never split into sub agents, never ask for more turns. a wireframe agent is waiting on this report and will write the document from it.',
  ].join('\n');
};
