import { useEffect, useMemo } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { buildSessionScripts } from '../../../scripts/buildSessionScripts';
import { openSessionTerminal } from '../../openSessionTerminal';
import { scriptCommandOf } from '../../scriptCommandOf';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly worktreePath: string;
};

export const TerminalScriptsMenu = ({ sessionId, workspaceId, worktreePath }: Props) => {
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const projects = useAppStore((state) => state.projects);
  const saved = useAppStore((state) => state.projectScripts[workspaceId] ?? EMPTY_ARRAY);
  const discovered = useAppStore((state) => state.discoveredScripts[sessionId]);
  const loadDiscoveredScripts = useAppStore((state) => state.loadDiscoveredScripts);
  useEffect(() => {
    void loadDiscoveredScripts({ sessionId, worktreePath });
  }, [loadDiscoveredScripts, sessionId, worktreePath]);
  const scripts = useMemo(() => {
    const group = buildSessionScripts({ mounts, projects, saved, discovered, pins: {} }).find(
      (candidate) => candidate.worktreePath === worktreePath && candidate.isReady,
    );
    if (group === undefined) {
      return [];
    }
    const all = [...group.scripts, ...group.suggested];
    return all.filter(
      (script, index) => all.findIndex((other) => other.key === script.key) === index,
    );
  }, [mounts, projects, saved, discovered, worktreePath]);
  const options: ReadonlyArray<ListboxOption<string>> = scripts.map((script) => ({
    value: script.key,
    label: script.name,
  }));
  return (
    <Listbox<string>
      options={options}
      value={null}
      trigger="quiet"
      size="sm"
      ariaLabel="Scripts"
      noun="script"
      emptyLabel="No scripts in this folder"
      searchable
      valueLabel={<span className="text-ui">Scripts</span>}
      popupWidth="content"
      onChange={(key) => {
        const script = scripts.find((candidate) => candidate.key === key);
        if (script === undefined) {
          return;
        }
        openSessionTerminal({
          state: useAppStore.getState(),
          sessionId,
          cwd: worktreePath,
          prefill: scriptCommandOf({ script }),
        });
      }}
    />
  );
};
