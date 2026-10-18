import type { AutoJob, CuratedProviderId } from './autoJob';

export const RUNGS = ['quick', 'light', 'standard', 'hard', 'top'] as const;

export type Rung = (typeof RUNGS)[number];

type Ladder = Readonly<Record<Rung, ReadonlyArray<AutoJob>>>;

const HAIKU_LOW: AutoJob = { group: 'Haiku', effort: 'low' };
const HAIKU_MEDIUM: AutoJob = { group: 'Haiku', effort: 'medium' };
const SONNET_MEDIUM: AutoJob = { group: 'Sonnet', effort: 'medium' };
const SONNET_HIGH: AutoJob = { group: 'Sonnet', effort: 'high' };
const SONNET_XHIGH: AutoJob = { group: 'Sonnet', effort: 'xhigh' };
const OPUS_HIGH: AutoJob = { group: 'Opus', effort: 'high' };

const LUNA_LOW: AutoJob = { group: 'GPT', checkpoint: 'Luna', effort: 'low' };
const LUNA_MEDIUM: AutoJob = { group: 'GPT', checkpoint: 'Luna', effort: 'medium' };
const SOL_MEDIUM: AutoJob = { group: 'GPT', checkpoint: 'Sol', effort: 'medium' };
const SOL_HIGH: AutoJob = { group: 'GPT', checkpoint: 'Sol', effort: 'high' };
const ASTRA_HIGH: AutoJob = { group: 'GPT', checkpoint: 'Astra', effort: 'high' };

const FLASH_LOW: AutoJob = { group: 'Gemini', checkpoint: 'Flash', effort: 'low' };
const FLASH_MEDIUM: AutoJob = { group: 'Gemini', checkpoint: 'Flash', effort: 'medium' };
const PRO_LOW: AutoJob = { group: 'Gemini', checkpoint: 'Pro', effort: 'low' };
const PRO_HIGH: AutoJob = { group: 'Gemini', checkpoint: 'Pro', effort: 'high' };

const AUTO: AutoJob = { group: 'Auto' };

export const EFFORT_LADDER: Readonly<Record<CuratedProviderId, Ladder>> = {
  anthropic: {
    quick: [HAIKU_LOW],
    light: [HAIKU_MEDIUM],
    standard: [SONNET_MEDIUM],
    hard: [SONNET_HIGH],
    top: [OPUS_HIGH],
  },
  codex: {
    quick: [LUNA_LOW],
    light: [LUNA_MEDIUM],
    standard: [SOL_MEDIUM],
    hard: [SOL_HIGH],
    top: [ASTRA_HIGH],
  },
  gemini: {
    quick: [FLASH_LOW],
    light: [FLASH_MEDIUM],
    standard: [PRO_LOW],
    hard: [PRO_HIGH],
    top: [PRO_HIGH],
  },
  cursor: {
    quick: [AUTO],
    light: [HAIKU_MEDIUM, AUTO],
    standard: [SONNET_MEDIUM],
    hard: [SONNET_HIGH],
    top: [OPUS_HIGH, SONNET_XHIGH],
  },
};

type NeighborParams = {
  readonly rung: Rung;
  readonly isHeavy: boolean;
};

export const rungsNear = ({ rung, isHeavy }: NeighborParams): ReadonlyArray<Rung> => {
  const at = RUNGS.indexOf(rung);
  const below = RUNGS.slice(0, at).reverse();
  return isHeavy ? [...RUNGS.slice(at + 1), ...below] : below;
};
