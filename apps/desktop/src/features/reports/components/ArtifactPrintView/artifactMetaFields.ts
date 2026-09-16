import type { SessionArtifact } from '@goodboy/types';
import { asReportType, REPORT_TYPE_LABEL } from '../../reportTypes';
import { formatPrintDate } from './formatPrintDate';

export type PrintMetaField = Readonly<{
  label: string;
  value: string;
}>;

type Params = {
  readonly artifact: SessionArtifact;
};

const reportTypeLabel = ({ artifact }: Params): string | null => {
  if (artifact.kind !== 'report') {
    return null;
  }
  const reportType = asReportType({ value: artifact.metadata.reportType });
  return reportType === null ? null : REPORT_TYPE_LABEL[reportType];
};

export const artifactMetaFields = ({ artifact }: Params): ReadonlyArray<PrintMetaField> => {
  const documentType = reportTypeLabel({ artifact });
  const prepared = formatPrintDate({ iso: artifact.createdAt });
  const fields: ReadonlyArray<PrintMetaField | null> = [
    documentType === null ? null : { label: 'Document', value: documentType },
    { label: 'Revision', value: String(artifact.revision) },
    prepared === '' ? null : { label: 'Prepared', value: prepared },
  ];
  return fields.filter((field): field is PrintMetaField => field !== null);
};
