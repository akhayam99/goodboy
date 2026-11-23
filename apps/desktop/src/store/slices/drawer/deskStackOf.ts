import type { OpenDrawer } from './state';

type Params = {
  readonly top: OpenDrawer | null;
  readonly back: OpenDrawer | null;
};

export type DeskAgentEntry = Extract<OpenDrawer, { readonly kind: 'transcript' }>;

export type DeskPrEntry = Extract<OpenDrawer, { readonly kind: 'pull-request' }>;

export type DeskStack = {
  readonly agent: DeskAgentEntry;
  readonly pr: DeskPrEntry;
};

export const deskStackOf = ({ top, back }: Params): DeskStack | null => {
  if (top === null || back === null || top.sessionId !== back.sessionId) {
    return null;
  }
  const entries = [top, back];
  const agent = entries.find((entry): entry is DeskAgentEntry => entry.kind === 'transcript');
  const pr = entries.find((entry): entry is DeskPrEntry => entry.kind === 'pull-request');
  return agent === undefined || pr === undefined ? null : { agent, pr };
};
