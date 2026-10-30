type Params = {
  readonly storedUsd: number | null;
  readonly draftUsd: number | null | undefined;
  readonly sessionCapUsd: number | null;
};

export type AutoLimitFacts = Readonly<{
  usd: number | null;
  isFromSession: boolean;
  isDefault: boolean;
  defaultUsd: number | null;
}>;

export const autoLimitOf = ({ storedUsd, draftUsd, sessionCapUsd }: Params): AutoLimitFacts => {
  const hasDraft = draftUsd !== undefined;
  const usd = hasDraft ? draftUsd : storedUsd;
  const isFromSession = sessionCapUsd !== null && (usd === null || sessionCapUsd < usd);
  return {
    usd: isFromSession ? sessionCapUsd : usd,
    isFromSession,
    isDefault: !isFromSession && !hasDraft && storedUsd !== null,
    defaultUsd: storedUsd,
  };
};
