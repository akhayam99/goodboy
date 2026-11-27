import { openLink } from '../open/openLink';

type Params = {
  readonly link: string;
};

export const joinCall = ({ link }: Params): void =>
  openLink({ url: link, sessionId: null, place: 'outside' });
