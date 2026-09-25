import { useMemo } from 'react';
import { Play, Square, SquareTerminal } from 'lucide-react';
import { Button, DrawerFrame } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { useScriptRun } from '../../hooks/useScriptRun';
import { useSessionScripts } from '../../hooks/useSessionScripts';
import { resolveScriptTarget } from '../../resolveScriptTarget';
import { ScriptCommandDisclosure } from './ScriptCommandDisclosure';
import { ScriptRunDock } from './ScriptRunDock';
import { ScriptRunLog } from './ScriptRunLog';
import { ScriptRunMeta } from './ScriptRunMeta';
import { runLogPlaceholder } from './runLogPlaceholder';

type Props = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly mountId: MountId | null;
  readonly onClose: () => void;
};

export const ScriptRunDrawer = ({ sessionId, scriptKey, mountId, onClose }: Props) => {
  const workspaceId = useAppStore(
    (state) => state.sessions.find((session) => session.id === sessionId)?.workspaceId ?? null,
  );
  const { groups } = useSessionScripts({ sessionId, workspaceId, shouldScan: false });
  const resolved = useMemo(
    () => resolveScriptTarget({ groups, scriptKey, mountId }),
    [groups, mountId, scriptKey],
  );
  const savedId = resolved?.script.savedId ?? null;
  const savedBody = useAppStore((state) => {
    if (savedId === null || workspaceId === null) {
      return null;
    }
    return (
      (state.projectScripts[workspaceId] ?? []).find((script) => script.id === savedId)?.body ??
      null
    );
  });
  const target = useMemo(() => {
    if (resolved === null || !resolved.group.isReady) {
      return null;
    }
    return {
      script: resolved.script,
      mountId: resolved.group.mountId,
      worktreePath: resolved.group.worktreePath,
    };
  }, [resolved]);
  const scriptRun = useScriptRun({ sessionId, scriptKey, target });
  const record = scriptRun.record;
  const title = resolved?.script.name ?? record?.name ?? 'Script';
  const command = savedBody ?? resolved?.script.command ?? null;
  const stdout = scriptRun.result?.stdout ?? record?.output ?? '';
  const stderr = scriptRun.result?.stderr ?? '';
  const blockedReason =
    resolved === null
      ? `${title} is no longer in this session`
      : `${resolved.group.projectName} is still preparing`;
  const output = stderr === '' ? stdout : `${stdout}${stdout === '' ? '' : '\n'}${stderr}`;

  const action = scriptRun.isRunning ? (
    <Button variant="secondary" size="sm" onClick={scriptRun.stop}>
      <Square size={ICON_SIZE.row} aria-hidden />
      Stop
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      onClick={scriptRun.run}
      disabled={!scriptRun.canRun}
      title={scriptRun.canRun ? undefined : blockedReason}
    >
      <Play size={ICON_SIZE.row} aria-hidden />
      {record === null ? 'Run' : 'Run again'}
    </Button>
  );

  return (
    <DrawerFrame
      title={title}
      icon={SquareTerminal}
      iconClassName="text-faint-foreground"
      closeLabel={`Close ${title} output`}
      action={action}
      onClose={onClose}
      dock={
        record === null ? null : (
          <ScriptRunDock
            status={scriptRun.status}
            exitCode={scriptRun.result?.exitCode ?? null}
            elapsedMs={scriptRun.elapsedMs}
            output={output}
          />
        )
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <ScriptRunMeta
          status={scriptRun.status}
          elapsedMs={scriptRun.elapsedMs}
          projectName={resolved?.group.projectName ?? null}
          branch={resolved?.group.branch ?? null}
        />
        {command === null ? null : <ScriptCommandDisclosure command={command} />}
        <ScriptRunLog
          stdout={stdout}
          stderr={stderr}
          placeholder={runLogPlaceholder({ status: scriptRun.status })}
        />
      </div>
    </DrawerFrame>
  );
};
