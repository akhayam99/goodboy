import { Chip } from '@goodboy/ui';
import type { CostCoverage } from '@goodboy/core';

type Props = {
  readonly coverage: CostCoverage;
};

export const CoverageChip = ({ coverage }: Props) => {
  if (coverage === 'unpriced') {
    return (
      <Chip
        className="rounded-md"
        kind="state"
        tone="warning"
        label="unpriced"
        title="No price for this model, so this figure isn't a measurement"
      />
    );
  }
  if (coverage === 'approximate') {
    return (
      <Chip
        className="rounded-md"
        kind="state"
        tone="neutral"
        label="approx"
        title="Priced from an estimated rate, not a billed amount"
      />
    );
  }
  return null;
};
