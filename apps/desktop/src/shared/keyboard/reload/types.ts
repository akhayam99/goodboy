export type ReloadSurface = {
  readonly isMain: boolean;
  readonly hasNativeView: boolean;
  readonly root: () => Element | null;
  readonly reload: () => void;
};
