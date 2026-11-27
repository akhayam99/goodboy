import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Play } from '@goodboy/ui/icons';
import { DrawerFrame, EmptyLine, ICON_SIZE, IconButton, SkeletonRow } from '@goodboy/ui';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useScriptPins } from '../../hooks/useScriptPins';
import { runWorkspaceScript } from '../../runWorkspaceScript';
import { workspaceScriptsOf } from '../../workspaceScriptsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly onClose: () => void;
};

export const WorkspaceScriptsDrawer = ({ workspaceId, projectId, onClose }: Props) => {
  const allProjects = useAppStore((state) => state.projects);
  const saved = useAppStore((state) => state.projectScripts[workspaceId] ?? EMPTY_ARRAY);
  const loadProjectRootScripts = useAppStore((state) => state.loadProjectRootScripts);
  const projects = useMemo(
    () => allProjects.filter((project) => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const scans = useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        projects.map((project) => [project.rootPath, state.projectRootScripts[project.rootPath]]),
      ),
    ),
  );
  const pins = useScriptPins({ projectIds: projects.map((project) => project.id) });
  const groups = workspaceScriptsOf({ projects, scans, saved, pins, projectId });

  useEffect(() => {
    for (const project of projects) {
      void loadProjectRootScripts({ rootPath: project.rootPath });
    }
  }, [loadProjectRootScripts, projects]);

  return (
    <DrawerFrame isDock title="Scripts" icon={CONCEPT_ICONS.scripts} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? <EmptyLine>No project in this workspace yet.</EmptyLine> : null}
        {groups.map((group) => (
          <section
            key={group.projectId}
            aria-label={group.projectName}
            className="flex flex-col gap-1"
          >
            <header className="flex h-8 items-center px-2">
              <span className="truncate text-row text-foreground">{group.projectName}</span>
            </header>
            {group.status === 'loading' ? (
              <SkeletonRow label={`Loading scripts of ${group.projectName}`} />
            ) : null}
            {group.status === 'error' ? (
              <EmptyLine>Couldn&apos;t read the scripts of {group.projectName}.</EmptyLine>
            ) : null}
            {group.status === 'ready' && group.scripts.length === 0 ? (
              <EmptyLine>No scripts in {group.projectName}.</EmptyLine>
            ) : null}
            {group.scripts.map((script) => (
              <div
                key={script.key}
                className="grid h-8 grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3 px-2"
              >
                <span className="truncate font-mono text-code text-foreground">{script.name}</span>
                <span className="truncate font-mono text-code text-faint-foreground">
                  {script.body}
                </span>
                <IconButton
                  size="xs"
                  variant="ghost"
                  icon={Play}
                  iconSize={ICON_SIZE.row}
                  label={`Run ${script.name} in ${group.projectName}`}
                  onClick={() =>
                    runWorkspaceScript({ workspaceId, rootPath: group.rootPath, script })
                  }
                />
              </div>
            ))}
          </section>
        ))}
      </div>
    </DrawerFrame>
  );
};
