import type { Project, SessionId } from '@goodboy/types';
import { listRegisteredWorktrees } from '../../../../features/worktree/listRegisteredWorktrees';
import { projectById } from '../../projects/projectIndex';
import { markWorktreeMissing, type WorktreeCandidate } from './markWorktreeMissing';

type Params<Candidate extends WorktreeCandidate> = {
  readonly candidatesBySession: ReadonlyMap<SessionId, ReadonlyArray<Candidate>>;
  readonly projects: ReadonlyArray<Project>;
};

type Entry<Candidate> = {
  readonly sessionId: SessionId;
  readonly candidate: Candidate;
};

type RepoGroup<Candidate> = {
  readonly repoPath: string;
  readonly entries: Array<Entry<Candidate>>;
};

export type VerifiedWorkspaceWorktrees<Candidate> = {
  readonly availableBySession: ReadonlyMap<SessionId, ReadonlyArray<Candidate>>;
};

export const verifyWorkspaceWorktrees = async <Candidate extends WorktreeCandidate>({
  candidatesBySession,
  projects,
}: Params<Candidate>): Promise<VerifiedWorkspaceWorktrees<Candidate>> => {
  const verified = new Set<Candidate>();
  const groups = new Map<string, RepoGroup<Candidate>>();
  for (const [sessionId, candidates] of candidatesBySession) {
    for (const candidate of candidates) {
      if (candidate.worktreePath === null) {
        continue;
      }
      const project = projectById(projects, candidate.projectId);
      if (project === undefined || project.kind !== 'repo') {
        verified.add(candidate);
        continue;
      }
      const group = groups.get(project.rootPath) ?? { repoPath: project.rootPath, entries: [] };
      group.entries.push({ sessionId, candidate });
      groups.set(project.rootPath, group);
    }
  }
  const verdicts = await Promise.all(
    [...groups.values()].map(async (group) => {
      const inspections = await listRegisteredWorktrees({
        repoPath: group.repoPath,
        worktreePaths: group.entries.map(({ candidate }) => candidate.worktreePath ?? ''),
      }).catch((error) => {
        console.error('list registered worktrees failed', error);
        return null;
      });
      return { group, inspections };
    }),
  );
  const missingEntries: Array<Entry<Candidate>> = [];
  for (const { group, inspections } of verdicts) {
    if (inspections === null) {
      continue;
    }
    group.entries.forEach((entry, index) => {
      const inspection = inspections[index];
      if (inspection?.kind === 'registered' && !inspection.isMain) {
        verified.add(entry.candidate);
        return;
      }
      if (inspection?.kind === 'missing') {
        missingEntries.push(entry);
      }
    });
  }
  await Promise.all(
    missingEntries.map(({ sessionId, candidate }) => markWorktreeMissing({ sessionId, candidate })),
  );
  const availableBySession = new Map<SessionId, ReadonlyArray<Candidate>>();
  for (const [sessionId, candidates] of candidatesBySession) {
    availableBySession.set(
      sessionId,
      candidates.filter((candidate) => verified.has(candidate)),
    );
  }
  return { availableBySession };
};
