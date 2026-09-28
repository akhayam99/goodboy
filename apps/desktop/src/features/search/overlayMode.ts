export type SwitchModeParams = {
  readonly text: string;
};

export type OverlayModeProps = {
  readonly initialText: string;
  readonly onSwitchMode: (params: SwitchModeParams) => void;
  readonly onClose: () => void;
};
