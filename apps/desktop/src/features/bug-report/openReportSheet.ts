import type { LastCrash } from './lastCrash';

export const OPEN_REPORT_SHEET_EVENT = 'goodboy:open-report-sheet';

export const REPORT_OPEN_MENU_EVENT = 'goodboy://report-open';

type ReportNotice = {
  readonly title: string;
  readonly body: string;
};

export type OpenReportSheetDetail = {
  readonly notice?: ReportNotice;
  readonly crash?: LastCrash;
};

export const openReportSheet = (detail: OpenReportSheetDetail = {}): void => {
  window.dispatchEvent(new CustomEvent<OpenReportSheetDetail>(OPEN_REPORT_SHEET_EVENT, { detail }));
};
