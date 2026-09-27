type Params = {
  readonly connected: Readonly<Record<string, boolean>>;
};

export const connectedInventory = ({ connected }: Params): string => {
  const states = Object.values(connected);
  const count = states.filter((isConnected) => isConnected).length;
  return `${count} of ${states.length} connected`;
};
