import type { Project, SessionId } from '@goodboy/types';
import { materializationGate, proposeMaterialization } from '../../materializationGate';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly stepName: string;
  readonly declarationText: string;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type MentionParams = {
  readonly text: string;
  readonly name: string;
};

const nameMention = ({ text, name }: MentionParams): string | null => {
  const pattern = new RegExp(`(^|[^a-z0-9_])${escapeRegExp(name)}([^a-z0-9_]|$)`, 'i');
  const line = text.split('\n').find((candidate) => pattern.test(candidate));
  return line === undefined ? null : line.trim();
};

type ReasonParams = {
  readonly stepName: string;
  readonly mentionLine: string | null;
};

const reasonFor = ({ stepName, mentionLine }: ReasonParams): string => {
  if (mentionLine === null || mentionLine === '') {
    return `declared by workflow step "${stepName}"`;
  }
  const clipped = mentionLine.length > 120 ? `${mentionLine.slice(0, 117)}...` : mentionLine;
  return `step "${stepName}": ${clipped}`;
};

export const materializeDeclaredProjects = async ({
  get,
  sessionId,
  stepName,
  declarationText,
}: Params): Promise<void> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return;
  }
  const projects = get().projects.filter((project) => project.workspaceId === session.workspaceId);
  if (projects.length <= 1) {
    return;
  }
  const mounts = get().sessionProjectMounts[sessionId] ?? [];
  const unmaterialized = projects.filter(
    (project) => !mounts.some((mount) => mount.projectId === project.id),
  );
  if (unmaterialized.length === 0) {
    return;
  }
  const declared: Array<{ project: Project; mentionLine: string | null }> = [];
  for (const project of unmaterialized) {
    const mentionLine = nameMention({ text: declarationText, name: project.name });
    if (mentionLine !== null) {
      declared.push({ project, mentionLine });
    }
  }
  let immediateCount = 0;
  for (const { project, mentionLine } of declared) {
    const reason = reasonFor({ stepName, mentionLine });
    const gate = materializationGate({ get, sessionId, project, immediateCount });
    if (gate === 'mounted') {
      continue;
    }
    if (gate === 'deferred') {
      await proposeMaterialization({ get, sessionId, project, reason, agentId: null });
      continue;
    }
    immediateCount += 1;
    await get()
      .materializeProject({ sessionId, projectId: project.id, reason })
      .catch(() => undefined);
  }
};
