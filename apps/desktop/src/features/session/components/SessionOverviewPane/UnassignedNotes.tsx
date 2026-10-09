import { useEffect, useMemo } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { Button, SectionHeader } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import {
  selectActiveMount,
  selectWritableMounts,
} from '../../../../store/slices/project-mounts/selectors';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';
import { UnassignedNote, type NoteTarget } from './UnassignedNote';

type Props = {
  readonly sessionId: SessionId;
};

export const UnassignedNotes = ({ sessionId }: Props) => {
  const { unassigned } = useBranchNotes({ sessionId });
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const assignDiffComment = useAppStore((s) => s.assignDiffComment);
  const discardDiffComments = useAppStore((s) => s.discardDiffComments);
  const mountViews = useAppStore((s) => s.sessionMounts[sessionId]);
  const projectMounts = useAppStore((s) => s.sessionProjectMounts[sessionId]);
  const activeMountId = useAppStore((s) => selectActiveMount({ state: s, sessionId })?.mountId);

  useEffect(() => {
    void loadDiffComments(sessionId);
  }, [loadDiffComments, sessionId]);

  const targets = useMemo<ReadonlyArray<NoteTarget>>(() => {
    const mounts = selectWritableMounts({
      state: {
        sessionMounts: mountViews === undefined ? {} : { [sessionId]: mountViews },
        sessionProjectMounts: projectMounts === undefined ? {} : { [sessionId]: projectMounts },
      },
      sessionId,
    });
    const seen = new Set<string>();
    return [...mounts]
      .sort((a, b) => Number(b.mountId === activeMountId) - Number(a.mountId === activeMountId))
      .flatMap((mount) => {
        const key = `${mount.projectId}\u0000${mount.branch}`;
        if (mount.branch === '' || seen.has(key)) {
          return [];
        }
        seen.add(key);
        return [{ mountId: mount.mountId, branch: mount.branch, mountName: mount.mountName }];
      });
  }, [activeMountId, mountViews, projectMounts, sessionId]);

  if (unassigned.length === 0) {
    return null;
  }

  const move = ({ noteId, mountId }: { readonly noteId: string; readonly mountId: MountId }) =>
    void assignDiffComment(sessionId, noteId, mountId);

  return (
    <section aria-label="Unassigned notes" className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label="Unassigned notes"
        headingLevel={2}
        hint="Written before notes were tied to a branch. Move or discard them."
        meta={
          <span className="text-label tabular-nums text-faint-foreground">{unassigned.length}</span>
        }
        action={
          unassigned.length >= 2 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void discardDiffComments({ sessionId, ids: unassigned.map((note) => note.id) })
              }
            >
              Discard all
            </Button>
          ) : undefined
        }
      />
      <ul className="flex min-w-0 flex-col gap-2">
        {unassigned.map((note) => (
          <UnassignedNote
            key={note.id}
            note={note}
            targets={targets}
            onMove={(mountId) => move({ noteId: note.id, mountId })}
            onDiscard={() => void discardDiffComments({ sessionId, ids: [note.id] })}
          />
        ))}
      </ul>
    </section>
  );
};
