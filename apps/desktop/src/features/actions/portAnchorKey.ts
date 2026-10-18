import type { PortActionTarget } from './types';

type Params = {
  readonly target: PortActionTarget;
};

export const portAnchorKey = ({ target }: Params): string =>
  target.facts.port === null
    ? `process:${target.facts.holder?.pid ?? 'none'}`
    : `port:${target.facts.port}`;

export const portMenuLabel = ({ target }: Params): string =>
  target.facts.port === null
    ? `Actions for ${target.facts.holder?.name ?? 'process'}`
    : `Actions for :${target.facts.port}`;
