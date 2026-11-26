type Params = {
  readonly hasTerminalActivity: boolean;
  readonly hasDownPin: boolean;
};

export const dockBusyKindsOf = ({
  hasTerminalActivity,
  hasDownPin,
}: Params): ReadonlyArray<string> => [
  ...(hasTerminalActivity ? ['terminal'] : []),
  ...(hasDownPin ? ['monitoring'] : []),
];
