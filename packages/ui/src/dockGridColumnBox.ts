export type DockGridPane = {
  readonly key: string;
  readonly weight: number;
  readonly tabs?: ReadonlyArray<string>;
};

export type DockGridColumnBox = {
  readonly width: number;
  readonly dragMax: number;
  readonly panes: ReadonlyArray<DockGridPane>;
};
