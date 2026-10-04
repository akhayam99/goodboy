import { useEffect, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { EmptyLine, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useScriptPins } from '../../hooks/useScriptPins';
import { scriptPinId } from '../../scriptPinId';
import { ProjectScriptRow } from './ProjectScriptRow';

type Props = {
  readonly project: Project;
};

const foldLabel = ({
  count,
  pinned,
  isReady,
}: {
  readonly count: number;
  readonly pinned: number;
  readonly isReady: boolean;
}): string => {
  if (isReady && count === 0) {
    return 'none found';
  }
  const parts = [isReady ? String(count) : null, pinned > 0 ? `${pinned} pinned` : null].filter(
    (part): part is string => part !== null,
  );
  return parts.join(', ');
};

export const ProjectScriptsFold = ({ project }: Props) => {
  const bodyId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const scan = useAppStore((state) => state.projectRootScripts[project.rootPath]);
  const loadProjectRootScripts = useAppStore((state) => state.loadProjectRootScripts);
  const toggleScriptPin = useAppStore((state) => state.toggleScriptPin);
  const reportError = useAppStore((state) => state.reportError);
  const pins = useScriptPins({ projectIds: [project.id] })[project.id] ?? [];
  const base = project.baseBranch ?? 'main';
  const groups =
    scan?.status === 'ready' ? scan.groups.filter((group) => group.scripts.length > 0) : [];
  const count = groups.reduce((sum, group) => sum + group.scripts.length, 0);
  const label = foldLabel({ count, pinned: pins.length, isReady: scan?.status === 'ready' });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadProjectRootScripts({ rootPath: project.rootPath });
  }, [isOpen, loadProjectRootScripts, project.rootPath]);

  const togglePin = (pinId: string) =>
    void toggleScriptPin({ projectId: project.id, pinId }).catch((error: unknown) =>
      reportError({ title: "Couldn't pin the script", error }),
    );

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        aria-label={`Scripts of ${project.name}`}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 items-center gap-2 rounded-sm px-2 text-left text-chip text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ChevronRight
          size={ICON_SIZE.control}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform',
            isOpen && 'rotate-90',
          )}
        />
        <span className="text-foreground">Scripts</span>
        {label === '' ? null : <span className="tabular-nums">· {label}</span>}
      </button>
      {isOpen ? (
        <div id={bodyId} className="flex flex-col gap-1 pb-1 pl-7 pr-2">
          {scan === undefined || scan.status === 'loading' ? (
            <p className="text-meta text-faint-foreground">Reading scripts on {base}…</p>
          ) : null}
          {scan?.status === 'error' ? <p className="text-meta text-danger">{scan.error}</p> : null}
          {scan?.status === 'ready' && count === 0 ? (
            <EmptyLine>No package.json or composer.json in {project.name}.</EmptyLine>
          ) : null}
          {count > 0 ? (
            <>
              <p className="text-meta text-faint-foreground">
                Scripts on {base}. Pin the ones you use; they show up in the Scripts page and in the
                palette.
              </p>
              {groups.map((group) => (
                <div key={`${group.source}:${group.relDir}`} className="flex flex-col">
                  {groups.length > 1 || group.relDir !== '' ? (
                    <span className="font-mono text-meta text-faint-foreground">
                      {group.relDir === '' ? group.packageName : group.relDir}
                    </span>
                  ) : null}
                  {group.scripts.map((script) => {
                    const pinId = scriptPinId({
                      source: group.source,
                      relDir: group.relDir,
                      name: script.name,
                      savedId: null,
                    });
                    return (
                      <ProjectScriptRow
                        key={script.name}
                        name={script.name}
                        command={script.body}
                        isPinned={pins.includes(pinId)}
                        onTogglePin={() => togglePin(pinId)}
                      />
                    );
                  })}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
