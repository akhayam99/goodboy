import type { ActionListOf } from './types';

const STOP_ROWS: ReadonlyArray<string> = ['port.stop', 'port.forceStop'];

const PORT_ROWS: ReadonlyArray<string> = [
  'port.openInBrowser',
  'port.pin',
  'port.editDescription',
  'port.unpin',
  'port.hide',
  'port.copyAddress',
];

const NO_ROWS: ReadonlyArray<string> = [];

type Params = {
  readonly hasStop: boolean;
};

type PortRowMenu = {
  readonly omit: ReadonlyArray<string>;
  readonly onlyOf: ActionListOf;
};

export const portRowMenuOf = ({ hasStop }: Params): PortRowMenu => ({
  omit: hasStop ? STOP_ROWS : NO_ROWS,
  onlyOf: ({ actions }) => {
    const canStop = actions.some((action) => action.id === 'port.stop');
    return hasStop ? PORT_ROWS : [...PORT_ROWS, canStop ? 'port.stop' : 'port.forceStop'];
  },
});
