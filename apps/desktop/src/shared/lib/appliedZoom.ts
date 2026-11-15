type WriteParams = {
  readonly factor: number;
};

const state = { factor: 1 };

export const appliedZoom = {
  read: (): number => state.factor,
  write: ({ factor }: WriteParams): void => {
    state.factor = factor;
  },
};
