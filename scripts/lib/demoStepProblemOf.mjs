export const demoStepProblemOf = ({ entry }) => {
  if (entry.resultMs < 0) {
    return `result never showed; header: ${entry.headerAfter}`;
  }
  if (entry.advanceMs !== undefined && entry.advanceMs < 0) {
    return `group never moved on; hash: ${entry.advancedTo}`;
  }
  if (entry.calloutCoversTarget || entry.calloutCoversChrome) {
    return 'callout covers its target or the app chrome';
  }
  return undefined;
};
