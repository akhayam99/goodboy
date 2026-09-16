import type { Agent, SessionArtifact } from '@goodboy/types';

export type ReportSourceLink =
  | Readonly<{ kind: 'agent'; id: string; label: string }>
  | Readonly<{ kind: 'artifact'; id: string; label: string }>;

export type ReportSourceLinkParams = Readonly<{
  sourceText: string;
  agents: ReadonlyArray<Agent>;
  artifacts: ReadonlyArray<SessionArtifact>;
  excludeArtifactId: string;
}>;

export const collectReportSourceLinks = ({
  sourceText,
  agents,
  artifacts,
  excludeArtifactId,
}: ReportSourceLinkParams): ReadonlyArray<ReportSourceLink> => {
  const agentLinks: ReadonlyArray<ReportSourceLink> = agents
    .filter((agent) => sourceText.includes(agent.id))
    .map((agent) => ({ kind: 'agent', id: agent.id, label: agent.name }));
  const artifactLinks: ReadonlyArray<ReportSourceLink> = artifacts
    .filter((artifact) => artifact.id !== excludeArtifactId && sourceText.includes(artifact.id))
    .map((artifact) => ({ kind: 'artifact', id: artifact.id, label: artifact.title }));
  return [...agentLinks, ...artifactLinks];
};
