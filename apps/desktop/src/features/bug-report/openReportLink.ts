import { copyToClipboard, formatError } from '@goodboy/ui';
import { openLinkOrThrow } from '../open/openLinkOrThrow';
import { buildReportLink, type ReportLink } from './reportBody';

type Params = {
  readonly title: string;
  readonly body: string;
};

type ReportLinkResult =
  | { readonly isOpened: true; readonly link: ReportLink }
  | { readonly isOpened: false; readonly message: string };

export const openReportLink = async ({ title, body }: Params): Promise<ReportLinkResult> => {
  const link = buildReportLink({ title, body });
  if (link.overflows) {
    try {
      await copyToClipboard({ text: `${title}\n\n${body}` });
    } catch (err) {
      return {
        isOpened: false,
        message: `Couldn't copy the report to your clipboard. ${formatError(err)}`,
      };
    }
  }
  try {
    await openLinkOrThrow({ url: link.url, sessionId: null, place: 'outside' });
  } catch (err) {
    return { isOpened: false, message: `Couldn't open GitHub. ${formatError(err)}` };
  }
  return { isOpened: true, link };
};
