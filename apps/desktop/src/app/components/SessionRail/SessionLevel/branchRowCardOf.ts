import type { Fact, FactCardSpec } from '@goodboy/ui';
import type { BranchRowFacts } from '../../../../features/branch/branchRowFactsOf';
import { pullRequestStateToneOf } from '../../../../features/branch/pullRequestStateToneOf';
import { factStateToneOf } from '../../../../shared/utils/factStateToneOf';
import type { BranchRowChip } from './branchRowChipOf';

type Params = {
  readonly facts: BranchRowFacts;
  readonly chip: BranchRowChip | null;
  readonly reason: string | null;
};

type ChipParams = {
  readonly chip: BranchRowChip;
};

const chipFactOf = ({ chip }: ChipParams): Fact => {
  const tone = factStateToneOf({ tone: chip.tone });
  return tone === 'neutral'
    ? { label: 'Status', value: chip.text }
    : { label: 'Status', value: chip.text, tone };
};

export const branchRowCardOf = ({ facts, chip, reason }: Params): FactCardSpec => {
  const why = chip?.reason ?? reason;
  return {
    title: facts.branch,
    ...(facts.number === null ? {} : { sub: facts.number }),
    ...(facts.stateWord === null
      ? {}
      : {
          state: {
            tone: factStateToneOf({ tone: pullRequestStateToneOf({ state: facts.state }).tone }),
            words: facts.stateWord,
          },
        }),
    facts: chip === null ? [] : [chipFactOf({ chip })],
    ...(why === null ? {} : { footnote: why }),
  };
};
