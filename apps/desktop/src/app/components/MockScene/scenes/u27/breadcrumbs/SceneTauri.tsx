import { useFakeTauri, type FakeHandlers } from '../../brand/fakeTauri';

type Props = {
  readonly handlers: FakeHandlers;
};

const HOLD_MS = 60_000;

export const SceneTauri = ({ handlers }: Props) => {
  useFakeTauri({ handlers, holdMs: HOLD_MS });
  return null;
};
