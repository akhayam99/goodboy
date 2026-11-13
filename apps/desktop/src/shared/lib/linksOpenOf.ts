import { DEFAULT_LINKS_OPEN, type LinksOpen } from './linksOpenSetting';

type Params = {
  readonly raw: string | null | undefined;
};

export const linksOpenOf = ({ raw }: Params): LinksOpen =>
  raw === 'browser' ? raw : DEFAULT_LINKS_OPEN;
