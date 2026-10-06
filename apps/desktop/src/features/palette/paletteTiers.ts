import type { SessionStage } from '@goodboy/types';
import type { SuggestionKind } from '../suggestions/types';
import type { PaletteEntry } from './types';

export type PaletteTier = 'archived' | 'needs' | 'live' | 'ship' | 'finished' | 'idle';

type TierParams = {
  readonly isArchived: boolean;
  readonly stage: SessionStage;
  readonly suggestionKinds: ReadonlyArray<SuggestionKind>;
};

type RankParams = {
  readonly tier: PaletteTier;
  readonly verbs: ReadonlyArray<PaletteEntry>;
  readonly limit?: number;
};

type RunVerbParams = {
  readonly verbs: ReadonlyArray<PaletteEntry>;
};

const SESSION_VERB_LIMIT = 8;

const SHIP_KINDS: ReadonlySet<SuggestionKind> = new Set<SuggestionKind>([
  'push-branch',
  'open-pr',
  'mark-ready',
  'merge-pr',
]);

const RECIPES: Readonly<Record<PaletteTier, ReadonlyArray<string>>> = {
  live: [
    'agent.interrupt',
    'agent.message',
    'session.diff',
    'session.terminal',
    'session.startAgent',
    'session.rename',
    'session.editor',
  ],
  needs: [
    'agent.message',
    'session.review',
    'session.startAgent',
    'session.terminal',
    'session.diff',
    'session.linkIssue',
    'session.rename',
  ],
  ship: [
    'session.review',
    'session.diff',
    'session.editor',
    'session.terminal',
    'session.copyBranch',
    'session.linkIssue',
    'session.rename',
  ],
  idle: [
    'session.startAgent',
    'session.linkIssue',
    'session.terminal',
    'session.editor',
    'session.diff',
    'session.rename',
    'session.copyBranch',
  ],
  finished: [
    'session.copyPr',
    'session.review',
    'session.diff',
    'session.rename',
    'session.copyBranch',
    'session.linkIssue',
    'session.terminal',
  ],
  archived: [
    'session.restore',
    'session.copyTitle',
    'session.copyWorktreePath',
    'session.copyBranch',
    'session.copyPr',
  ],
};

const RUN_VERB_ORDER: ReadonlyArray<string> = [
  'workflowRun.answer',
  'workflowRun.start',
  'workflowRun.continue',
  'workflowRun.nextStep',
  'workflowRun.restartStep',
  'workflowRun.close',
];

export const paletteTierOf = ({ isArchived, stage, suggestionKinds }: TierParams): PaletteTier => {
  if (isArchived) {
    return 'archived';
  }
  if (stage === 'attention') {
    return 'needs';
  }
  if (stage === 'running') {
    return 'live';
  }
  if (stage === 'done') {
    return 'finished';
  }
  if (stage === 'review' || suggestionKinds.some((kind) => SHIP_KINDS.has(kind))) {
    return 'ship';
  }
  return 'idle';
};

const actionIdOf = (entry: PaletteEntry): string => entry.action?.id ?? entry.key;

const isDanger = (entry: PaletteEntry): boolean => entry.action?.group === 'danger';

const isOpenVerb = (entry: PaletteEntry): boolean =>
  entry.action !== undefined && entry.action.group === 'open' && entry.action.id.endsWith('.open');

const isRunnable = (entry: PaletteEntry): boolean => entry.isBlocked !== true;

const orderBy = ({
  order,
  entries,
}: {
  readonly order: ReadonlyArray<string>;
  readonly entries: ReadonlyArray<PaletteEntry>;
}): ReadonlyArray<PaletteEntry> =>
  entries
    .map((entry, index) => {
      const at = order.indexOf(actionIdOf(entry));
      return { entry, index, rank: at === -1 ? order.length + index : at };
    })
    .sort((first, second) => first.rank - second.rank)
    .map(({ entry }) => entry);

export const rankSessionVerbs = ({
  tier,
  verbs,
  limit = SESSION_VERB_LIMIT,
}: RankParams): ReadonlyArray<PaletteEntry> =>
  orderBy({
    order: RECIPES[tier],
    entries: verbs.filter(
      (entry) =>
        isRunnable(entry) &&
        !isOpenVerb(entry) &&
        !isDanger(entry) &&
        (tier !== 'archived' || RECIPES.archived.includes(actionIdOf(entry))),
    ),
  }).slice(0, limit);

export const orderRunVerbs = ({ verbs }: RunVerbParams): ReadonlyArray<PaletteEntry> =>
  orderBy({
    order: RUN_VERB_ORDER,
    entries: verbs.filter(
      (entry) => isRunnable(entry) && RUN_VERB_ORDER.includes(actionIdOf(entry)),
    ),
  });
