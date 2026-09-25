export type ToggleFolderParams = {
  readonly path: string;
  readonly isOn: boolean;
};

export type ToggleFolder = (params: ToggleFolderParams) => void;
