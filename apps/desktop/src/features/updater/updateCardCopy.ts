import type { UpdateFailure } from '../../store/slices/updater/state';
import type { UpdateCardState } from './updateCardState';

type CopyParams = {
  readonly state: UpdateCardState;
  readonly version: string | null;
  readonly runningCount: number;
  readonly failure: UpdateFailure | null;
};

export type UpdateCardCopy = {
  readonly title: string;
  readonly body: string;
  readonly detail: string | null;
};

type NameParams = {
  readonly version: string | null;
};

const updateNameOf = ({ version }: NameParams): string =>
  version === null ? 'The update' : `Goodboy ${version}`;

type CountParams = {
  readonly count: number;
};

const agentsRunningLine = ({ count }: CountParams): string =>
  count === 1 ? '1 agent is running' : `${count} agents are running`;

const queuedTitleOf = ({ count }: CountParams): string =>
  count === 1 ? 'Restarts when the agent finishes' : `Restarts when ${count} agents finish`;

export const updateCardCopy = ({
  state,
  version,
  runningCount,
  failure,
}: CopyParams): UpdateCardCopy => {
  const name = updateNameOf({ version });
  switch (state) {
    case 'available':
      return {
        title: `${name} is available`,
        body: 'It downloads in about a minute. Nothing restarts until you say so.',
        detail: null,
      };
    case 'ready':
      return {
        title: `${name} is ready`,
        body: 'Nothing is running. A restart takes a few seconds.',
        detail: null,
      };
    case 'running':
      return {
        title: agentsRunningLine({ count: runningCount }),
        body: 'A restart now picks them up where they stopped.',
        detail: null,
      };
    case 'failed':
      return {
        title: `${name} did not install`,
        body: 'Nothing changed on this Mac.',
        detail: failure === null ? null : failure.message,
      };
    case 'queued':
      return {
        title: queuedTitleOf({ count: runningCount }),
        body: `Then ${name} installs.`,
        detail: null,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

type PillParams = {
  readonly state: UpdateCardState;
  readonly version: string | null;
  readonly runningCount: number;
};

export const updatePillLabel = ({ state, version, runningCount }: PillParams): string => {
  if (state === 'running') {
    return `${updateNameOf({ version })} is ready`;
  }
  return updateCardCopy({ state, version, runningCount, failure: null }).title;
};
