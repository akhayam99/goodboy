import { openTarget } from '../open/openTarget';
import { PLAIN_CLICK } from '../open/plainClick';
type Params = {
  readonly url: string;
};

export const openInYourBrowser = async ({ url }: Params): Promise<void> => {
  await openTarget({
    target: { kind: 'web', url },
    sessionId: null,
    event: PLAIN_CLICK,
    place: 'outside',
  });
};
