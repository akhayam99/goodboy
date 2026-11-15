type Params = {
  readonly branchCount: number;
  readonly mergedCount: number;
  readonly openQuestionCount: number;
  readonly hasLiveAgent: boolean;
  readonly isArchived: boolean;
};

export const isArchivePrimaryOf = ({
  branchCount,
  mergedCount,
  openQuestionCount,
  hasLiveAgent,
  isArchived,
}: Params): boolean =>
  !isArchived &&
  branchCount > 0 &&
  mergedCount === branchCount &&
  openQuestionCount === 0 &&
  !hasLiveAgent;
