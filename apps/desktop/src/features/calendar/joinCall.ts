import { openLinkOrThrow } from '../open/openLinkOrThrow';
import { reportChipError } from './chip/reportChipError';

type Params = {
  readonly link: string;
};

export const joinCall = async ({ link }: Params): Promise<boolean> => {
  try {
    await openLinkOrThrow({ url: link, sessionId: null, place: 'outside' });
    return true;
  } catch (error) {
    reportChipError({ title: "Couldn't open the call link", error });
    return false;
  }
};
