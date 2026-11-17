export type DockGridPane = {
  readonly key: string;
  readonly weight: number;
};

export type DockGridColumnBox = {
  readonly width: number;
  readonly dragMax: number;
  readonly panes: ReadonlyArray<DockGridPane>;
};
