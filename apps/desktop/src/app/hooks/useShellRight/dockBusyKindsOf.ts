type Params = {
  readonly hasTerminalActivity: boolean;
  readonly hasDownPin: boolean;
  readonly isAskStreaming: boolean;
};

export const dockBusyKindsOf = ({
  hasTerminalActivity,
  hasDownPin,
  isAskStreaming,
}: Params): ReadonlyArray<string> => [
  ...(hasTerminalActivity ? ['terminal'] : []),
  ...(hasDownPin ? ['monitoring'] : []),
  ...(isAskStreaming ? ['ask'] : []),
];
