import type { AgentId, IsoDateTime, ProviderRunId, Session, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { parseSlashCommand } from '@goodboy/core';
import { resolveSkillInvocation } from '../../../features/skills/skills';
import type { AppStore } from '../../store';
import type { GetFn } from './types';
import { resolveSessionRepo } from '../worktrees/resolveSessionRepo';

type Params = {
  before: AppStore;
  session: Session;
  sessionId: SessionId;
  activeAgentId: AgentId;
  workingDir: string;
  content: string;
  now: () => IsoDateTime;
};

export const resolveSkillPrompt = async (
  get: GetFn,
  { before, session, sessionId, activeAgentId, workingDir, content, now }: Params,
): Promise<{ ok: true; resolvedPrompt: string } | { ok: false }> => {
  let resolvedPrompt = content;
  const slashCmd = parseSlashCommand(content);
  if (slashCmd !== null) {
    const workspaceSkills = before.skills[session.workspaceId] ?? [];
    const skill = workspaceSkills.find((s) => s.name === slashCmd.name);
    if (!skill) {
      const errRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: errRunId,
        message: `unknown skill: /${slashCmd.name}`,
        at: now(),
      });
      return { ok: false };
    }
    const workspace = before.workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) {
      const errRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: errRunId,
        message: `workspace not found: ${session.workspaceId}`,
        at: now(),
      });
      return { ok: false };
    }
    try {
      const repo = resolveSessionRepo({ state: before, sessionId });
      const result = await resolveSkillInvocation({
        skill,
        args: slashCmd.args,
        workingDir,
        workspaceRoot: repo?.repoRoot ?? workspace.rootPath,
      });
      resolvedPrompt = result.resolvedPrompt;
      const skillRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'skill_invocation',
        runId: skillRunId,
        skillName: result.skillName,
        args: result.args,
        at: now(),
      });
    } catch (err) {
      const message = formatError(err);
      const errRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId: errRunId,
        message,
        at: now(),
      });
      return { ok: false };
    }
  }
  return { ok: true, resolvedPrompt };
};
