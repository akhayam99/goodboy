import type { Project, SessionId } from '@goodboy/types';
import { inspectWorktree } from '../../../features/worktree/worktree';
import { projectById } from '../projects/projectIndex';
import { markWorktreeMissing, type WorktreeCandidate } from './verify/markWorktreeMissing';

type Params<Candidate extends WorktreeCandidate> = {
  readonly sessionId: SessionId;
  readonly candidates: ReadonlyArray<Candidate>;
  readonly projects: ReadonlyArray<Project>;
};

export type VerifiedWorktrees<Candidate> = {
  readonly available: ReadonlyArray<Candidate>;
  readonly missing: ReadonlyArray<string>;
};

export const verifyAvailableWorktrees = async <Candidate extends WorktreeCandidate>({
  sessionId,
  candidates,
  projects,
}: Params<Candidate>): Promise<VerifiedWorktrees<Candidate>> => {
  const available: Array<Candidate> = [];
  const missing: Array<string> = [];
  for (const candidate of candidates) {
    if (candidate.worktreePath === null) {
      continue;
    }
    const project = projectById(projects, candidate.projectId);
    if (project === undefined || project.kind !== 'repo') {
      available.push(candidate);
      continue;
    }
    const inspection = await inspectWorktree({
      repoPath: project.rootPath,
      worktreePath: candidate.worktreePath,
    }).catch(() => null);
    if (inspection?.kind === 'registered' && !inspection.isMain) {
      available.push(candidate);
      continue;
    }
    if (inspection?.kind !== 'missing') {
      continue;
    }
    missing.push(candidate.id);
    await markWorktreeMissing({ sessionId, candidate });
  }
  return { available, missing };
};
