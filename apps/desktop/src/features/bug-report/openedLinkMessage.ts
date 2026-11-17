import type { ReportLinkOpened } from './components/ReportComposer';

const SEND_FAILURE_CAP = 160;

type Params = {
  readonly opened: ReportLinkOpened;
};

export const openedLinkMessage = ({ opened }: Params): string => {
  const next = opened.overflows
    ? 'The rest did not fit the link and is on your clipboard. Paste it into the issue, then submit.'
    : 'Submit the form in your browser to file the issue.';
  if (opened.sendFailure === null) {
    return next;
  }
  return `GitHub didn't take the report: ${opened.sendFailure.slice(0, SEND_FAILURE_CAP)}. The same text is open in your browser. ${next}`;
};
