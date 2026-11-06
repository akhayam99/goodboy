import type { SessionId } from '@goodboy/types';
import { openLens } from './openLens';
import type { Page } from './pageRegistry';

type Params = {
  readonly sessionId: SessionId;
  readonly page: Page;
};

export const openSessionPage = ({ sessionId, page }: Params): void => {
  openLens({ sessionId, lens: page.lens });
};
