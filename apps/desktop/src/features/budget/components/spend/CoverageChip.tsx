import { Chip } from '@goodboy/ui';
import type { CostCoverage } from '@goodboy/core';

type Props = {
  readonly coverage: CostCoverage;
};

export const CoverageChip = ({ coverage }: Props) => {
  if (coverage === 'unpriced') {
    return (
      <Chip
        tone="warning"
        shape="badge"
        label="unpriced"
        title="No price for this model, so this figure is not a measurement"
      />
    );
  }
  if (coverage === 'approximate') {
    return (
      <Chip
        tone="neutral"
        shape="badge"
        label="approx"
        title="Priced from an estimated rate, not a billed amount"
      />
    );
  }
  return null;
};
