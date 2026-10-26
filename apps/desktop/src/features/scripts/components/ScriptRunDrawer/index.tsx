import { useEffect, useMemo } from 'react';
import { Square, SquareTerminal } from 'lucide-react';
import { Button, DrawerFrame, ICON_SIZE, type DrawerBack } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';

import { useAppStore } from '../../../../store';
import { useScriptRun } from '../../hooks/useScriptRun';
import { useSessionScripts } from '../../hooks/useSessionScripts';
import { resolveScriptTarget } from '../../resolveScriptTarget';
import { scriptOutcomeLabel } from '../../scriptOutcomeLabel';
import { scriptRecordOutput } from '../../scriptRecordOutput';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { ScriptCommandDisclosure } from './ScriptCommandDisclosure';
import { ScriptRunDock } from './ScriptRunDock';
import { ScriptRunLog } from './ScriptRunLog';
import { RunButton } from './RunButton';
import { ScriptRunMeta } from './ScriptRunMeta';
import { runLogPlaceholder } from './runLogPlaceholder';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { openFileLink } from '../../../explore/openFileLink';
import { discoveredScriptCwd } from '../../scripts';

type Props = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly mountId: MountId | null;
  readonly back?: DrawerBack;
  readonly onClose: () => void;
};

export const ScriptRunDrawer = ({ sessionId, scriptKey, mountId, back, onClose }: Props) => {
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
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
  const fileRoot = target?.worktreePath ?? null;
  const fileBaseDir =
    target === null
      ? null
      : discoveredScriptCwd({
          worktreePath: target.worktreePath,
          relDir: target.script.relDir,
        });
  const record = scriptRun.record;
  const markScriptRunSeen = useAppStore((state) => state.markScriptRunSeen);
  const seenRunId = record !== null && record.status !== 'pending' ? record.runId : null;
  useEffect(() => {
    if (seenRunId !== null) {
      markScriptRunSeen({ sessionId, scriptKey, runId: seenRunId });
    }
  }, [markScriptRunSeen, scriptKey, seenRunId, sessionId]);
  const title = resolved?.script.name ?? record?.name ?? 'Script';
  const command = savedBody ?? resolved?.script.invocation ?? null;
  const stdout = scriptRun.result?.stdout ?? record?.output ?? '';
  const stderr = scriptRun.result?.stderr ?? '';
  const blockedReason =
    resolved === null
      ? `${title} is no longer in this session`
      : `${resolved.group.projectName} is still preparing`;
  const output = scriptRecordOutput({ record });
  const handOutput = useHandOutputToAgent({ sessionId });
  const askAboutOutput = () =>
    handOutput.handOff({
      subject: title,
      outcome: scriptOutcomeLabel({
        status: scriptRun.status,
        exitCode: scriptRun.result?.exitCode ?? null,
      }),
      projectName: resolved?.group.projectName ?? null,
      branch: resolved?.group.branch ?? null,
      output,
    });

  const action = scriptRun.isRunning ? (
    <Button variant="secondary" size="sm" onClick={scriptRun.stop}>
      <Square size={ICON_SIZE.row} aria-hidden />
      Stop
    </Button>
  ) : (
    <RunButton
      canRun={scriptRun.canRun}
      blockedReason={blockedReason}
      label={record === null ? 'Run' : 'Run again'}
      isPrimary={record === null}
      onRun={scriptRun.run}
    />
  );

  return (
    <DrawerFrame
      title={title}
      {...(resolved !== null && { count: resolved.group.projectName })}
      icon={SquareTerminal}
      iconClassName="text-faint-foreground"
      action={action}
      {...(back !== undefined && { back })}
      onClose={onClose}
      dock={
        record === null ? null : (
          <ScriptRunDock
            status={scriptRun.status}
            exitCode={scriptRun.result?.exitCode ?? null}
            elapsedMs={scriptRun.elapsedMs}
            output={output}
            canAsk={handOutput.canHandOff}
            askLabel={handOutput.askLabel}
            onAsk={askAboutOutput}
          />
        )
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <ScriptRunMeta
          status={scriptRun.status}
          elapsedMs={scriptRun.elapsedMs}
          branch={resolved === null || resolved.group.branch === '' ? null : resolved.group.branch}
        />
        {command === null ? null : <ScriptCommandDisclosure command={command} />}
        <ScriptRunLog
          stdout={stdout}
          stderr={stderr}
          placeholder={runLogPlaceholder({ status: scriptRun.status })}
          onOpenFile={
            fileRoot === null || fileBaseDir === null
              ? null
              : (link) =>
                  void openFileLink({ sessionId, root: fileRoot, baseDir: fileBaseDir, link })
          }
        />
      </div>
    </DrawerFrame>
  );
};
