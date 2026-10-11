import type { PortRow } from '@goodboy/core';

type Params = {
  readonly ports: ReadonlyArray<PortRow>;
};

export type PortSummary = {
  readonly inUse: number;
  readonly total: number;
};

export const portSummary = ({ ports }: Params): PortSummary => ({
  inUse: ports.filter((row) => row.state === 'listening').length,
  total: ports.length,
});
