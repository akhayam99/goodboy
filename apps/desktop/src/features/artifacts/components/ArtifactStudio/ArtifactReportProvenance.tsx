import { useMemo } from 'react';
import type {
  Agent,
  AgentId,
  ArtifactId,
  ReportArtifact,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { collectReportSourceLinks } from '../../../reports/reportSourceLinks';
import { asReportType, REPORT_TYPE_LABEL } from '../../../reports/reportTypes';
import { ReportProvenanceRow } from '../../../reports/components/ReportStudio/ReportProvenanceRow';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: ReportArtifact;
  readonly agents: ReadonlyArray<Agent>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
};

export const ArtifactReportProvenance = ({
  sessionId,
  artifact,
  agents,
  artifacts,
  onSelectArtifact,
}: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  const links = useMemo(
    () =>
      collectReportSourceLinks({
        sourceText: artifact.sourceText,
        agents,
        artifacts,
        excludeArtifactId: artifact.id,
      }),
    [agents, artifacts, artifact.id, artifact.sourceText],
  );
  const reportType = asReportType({ value: artifact.metadata.reportType });

  return (
    <ReportProvenanceRow
      reportType={
        reportType === null ? artifact.metadata.reportType : REPORT_TYPE_LABEL[reportType]
      }
      links={links}
      onOpenAgent={(agentId: AgentId) => void selectAgent(sessionId, agentId)}
      onOpenArtifact={onSelectArtifact}
    />
  );
};
