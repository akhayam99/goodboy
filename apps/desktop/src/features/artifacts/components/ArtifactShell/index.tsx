import type { Agent, SessionId } from '@goodboy/types';
import type { ArtifactShellSubject } from './artifactShellSubject';
import { ArtifactDocumentShell } from './ArtifactDocumentShell';
import { ArtifactGenerationShell } from './ArtifactGenerationShell';

type Props = {
  readonly sessionId: SessionId;
  readonly subject: ArtifactShellSubject;
  readonly agents: ReadonlyArray<Agent>;
};

export const ArtifactShell = ({ sessionId, subject, agents }: Props) =>
  subject.kind === 'generation' ? (
    <ArtifactGenerationShell sessionId={sessionId} generation={subject.generation} />
  ) : (
    <ArtifactDocumentShell sessionId={sessionId} subject={subject} agents={agents} />
  );
