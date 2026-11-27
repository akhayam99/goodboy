import { HOME_LAYOUT_VERSION, type HomeLayout } from './layoutTypes';

type Params = {
  readonly entries: HomeLayout;
};

export const serializeHomeLayout = ({ entries }: Params): string =>
  JSON.stringify({
    v: HOME_LAYOUT_VERSION,
    widgets: entries.map(({ id, size }) => ({ id, size })),
  });
