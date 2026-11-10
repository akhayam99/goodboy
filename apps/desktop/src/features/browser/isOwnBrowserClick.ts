import { currentPlatform } from '../../shared/platform';

type Params = {
  readonly event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>;
};

export const isOwnBrowserClick = ({ event }: Params): boolean =>
  currentPlatform() === 'darwin' ? event.metaKey : event.ctrlKey;
