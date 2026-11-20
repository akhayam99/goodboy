type Params = {
  readonly keys: ReadonlyArray<string>;
};

export const dockSplitKeyOf = ({ keys }: Params): string => keys.join('/');
