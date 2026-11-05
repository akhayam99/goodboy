const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;

type Params = {
  readonly button: number;
};

export const isCountedClick = ({ button }: Params) =>
  button === PRIMARY_BUTTON || button === MIDDLE_BUTTON;
