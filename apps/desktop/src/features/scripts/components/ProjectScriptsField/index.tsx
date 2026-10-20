import { useEffect, useState } from 'react';
import type { Project } from '@goodboy/types';
import { Button, EmptyLine, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { autoChecksKey } from '../../autoChecksKey';
import { useScriptPins } from '../../hooks/useScriptPins';
import { parseScriptPins } from '../../parseScriptPins';
import { scriptPinId } from '../../scriptPinId';
import { ProjectScriptRow } from './ProjectScriptRow';

type Props = {
  readonly project: Project;
};

type LabelParams = {
  readonly pinned: number;
};

const labelOf = ({ pinned }: LabelParams): string =>
  pinned > 0 ? `Scripts · ${pinned} pinned` : 'Scripts';

export const ProjectScriptsField = ({ project }: Props) => {
  const scan = useAppStore((state) => state.projectRootScripts[project.rootPath]);
  const loadProjectRootScripts = useAppStore((state) => state.loadProjectRootScripts);
  const toggleScriptPin = useAppStore((state) => state.toggleScriptPin);
  const toggleAutoCheck = useAppStore((state) => state.toggleAutoCheck);
  const reportError = useAppStore((state) => state.reportError);
  const rawAutoChecks = useAppStore(
    (state) => state.settings[autoChecksKey({ projectId: project.id })],
  );
  const autoChecks = parseScriptPins({ raw: rawAutoChecks });
  const pins = useScriptPins({ projectIds: [project.id] })[project.id] ?? [];
  const [isRetrying, setIsRetrying] = useState(false);
  const base = project.baseBranch ?? 'main';
  const groups =
    scan?.status === 'ready' ? scan.groups.filter((group) => group.scripts.length > 0) : [];
  const count = groups.reduce((sum, group) => sum + group.scripts.length, 0);

  useEffect(() => {
    void loadProjectRootScripts({ rootPath: project.rootPath });
  }, [loadProjectRootScripts, project.rootPath]);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await loadProjectRootScripts({ rootPath: project.rootPath });
    } finally {
      setIsRetrying(false);
    }
  };

  const toggleCheck = (pinId: string) =>
    void toggleAutoCheck({ projectId: project.id, pinId }).catch((error: unknown) =>
      reportError({ title: "Couldn't change the Auto checks", error }),
    );

  const togglePin = (pinId: string) =>
    void toggleScriptPin({ projectId: project.id, pinId }).catch((error: unknown) =>
      reportError({ title: "Couldn't pin the script", error }),
    );

  return (
    <div role="group" aria-label={`Scripts of ${project.name}`} className="flex flex-col gap-1">
      <span className="text-label text-muted-foreground">{labelOf({ pinned: pins.length })}</span>
      {scan === undefined || scan.status === 'loading' ? (
        <p className="text-meta text-faint-foreground">Reading scripts on {base}…</p>
      ) : null}
      {scan?.status === 'error' ? (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't read the scripts"
          body={scan.error}
          actions={
            <Button
              variant="secondary"
              size="sm"
              disabled={isRetrying}
              onClick={() => void retry()}
            >
              Retry
            </Button>
          }
        />
      ) : null}
      {scan?.status === 'ready' && count === 0 ? (
        <EmptyLine>No package.json or composer.json in {project.name}.</EmptyLine>
      ) : null}
      {count > 0 ? (
        <>
          <p className="text-meta text-faint-foreground">
            On {base}. Pinned scripts show on a session&apos;s Scripts page and under $ in the
            palette. Auto runs the scripts used as checks after an agent changes code.
          </p>
          {groups.map((group) => (
            <div key={`${group.source}:${group.relDir}`} className="flex flex-col">
              {groups.length > 1 ? (
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
                    isAutoCheck={autoChecks.includes(pinId)}
                    onTogglePin={() => togglePin(pinId)}
                    onToggleAutoCheck={() => toggleCheck(pinId)}
                  />
                );
              })}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
};
