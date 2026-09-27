export const OPEN_REPORT_SHEET_EVENT = 'goodboy:open-report-sheet';

export type ReportNotice = {
  readonly title: string;
  readonly body: string;
};

export type OpenReportSheetDetail = {
  readonly notice?: ReportNotice;
};

export const openReportSheet = (detail: OpenReportSheetDetail = {}): void => {
  window.dispatchEvent(new CustomEvent<OpenReportSheetDetail>(OPEN_REPORT_SHEET_EVENT, { detail }));
};
