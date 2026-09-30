import type { ArtifactKind, SessionArtifact } from '@goodboy/types';
import { asReportType, REPORT_TYPE_LABEL } from '../../../reports/reportTypes';
import { formatDate } from '../../../../shared/utils/time/formatDate';

const KIND_LABEL: Readonly<Record<ArtifactKind, string>> = {
  report: 'Report',
  plan: 'Plan',
  wireframe: 'Wireframe',
};

export type ArtifactDocumentMeta = Readonly<{
  eyebrowLabel: string;
  dateLabel: string;
}>;

type Params = {
  readonly artifact: SessionArtifact;
  readonly workspaceName: string;
};

const typeLabel = ({ artifact }: { readonly artifact: SessionArtifact }): string => {
  if (artifact.kind !== 'report') {
    return KIND_LABEL[artifact.kind];
  }
  const reportType = asReportType({ value: artifact.metadata.reportType });
  return reportType === null ? KIND_LABEL.report : REPORT_TYPE_LABEL[reportType];
};

export const artifactMetaFields = ({ artifact, workspaceName }: Params): ArtifactDocumentMeta => ({
  eyebrowLabel: `${workspaceName} · ${typeLabel({ artifact })}`,
  dateLabel: formatDate({ at: artifact.createdAt }),
});
