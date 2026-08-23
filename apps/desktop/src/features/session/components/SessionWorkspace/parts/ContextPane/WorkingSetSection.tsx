import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { ContextSection } from './ContextSection';
import { WorkingSetRow } from './WorkingSetRow';

type Props = {
  readonly session: Session;
};

export const WorkingSetSection = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const mounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((s) => s.projects);
  const storedActiveId = useAppStore((s) => s.sessionActiveProject[sessionId]);
  const activeProjectId = storedActiveId ?? session.activeProjectId;
  const bio = useAppStore(
    (s) =>
      s.workspaces
        .find((workspace) => workspace.id === session.workspaceId)
        ?.profile?.bio?.trim() ?? '',
  );

  return (
    <ContextSection
      concept="explore"
      sectionId="context-working-set"
      title="Working set"
      description="Where the session is working, derived from its mounted projects."
    >
      <div className="flex flex-col gap-2.5">
        {bio !== '' ? <p className="truncate text-xs text-muted-foreground">{bio}</p> : null}
        {mounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">This session has no mounted projects yet.</p>
        ) : (
          mounts.map((mount) => {
            const project = projects.find((candidate) => candidate.id === mount.projectId);
            const kind = project?.kind ?? (mount.branch === '' ? 'folder' : 'repo');
            return (
              <WorkingSetRow
                key={mount.projectId}
                mount={mount}
                kind={kind}
                isActive={mount.projectId === activeProjectId}
              />
            );
          })
        )}
      </div>
    </ContextSection>
  );
};
