const STOP_ROWS: ReadonlyArray<string> = ['port.stop', 'port.forceStop'];

const PORT_ROW_CUTS: ReadonlyArray<string> = ['port.copyAddress', 'port.hide'];

const NO_ROWS: ReadonlyArray<string> = [];

type Params = {
  readonly hasStop: boolean;
};

type PortRowMenu = {
  readonly omit: ReadonlyArray<string>;
  readonly cuts: ReadonlyArray<string>;
};

export const portRowMenuOf = ({ hasStop }: Params): PortRowMenu => ({
  omit: hasStop ? STOP_ROWS : NO_ROWS,
  cuts: PORT_ROW_CUTS,
});
