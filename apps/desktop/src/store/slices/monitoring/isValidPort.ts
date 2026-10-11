type Params = {
  readonly port: number;
};

export const isValidPort = ({ port }: Params): boolean =>
  Number.isInteger(port) && port >= 1 && port <= 65535;
