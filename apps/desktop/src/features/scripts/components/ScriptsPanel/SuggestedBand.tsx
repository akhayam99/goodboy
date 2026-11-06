import { Pin } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import { scriptOutcomeLabel } from '../../scriptOutcomeLabel';
import { scriptRunRecordFor } from '../../scriptRunRecordFor';
import type { ScriptRunRecord } from '../../scripts';
import { SuggestedRow } from '../ScriptRow/SuggestedRow';
import { ScriptBand } from './ScriptBand';

type Props = {
  readonly group: SessionScriptGroup;
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly canPick: boolean;
  readonly isPickerOpen: boolean;
  readonly onTogglePicker: () => void;
  readonly onRun: (script: RunnableScript) => void;
  readonly onPin: (script: RunnableScript) => void;
};

export const SuggestedBand = ({
  group,
  runs,
  canPick,
  isPickerOpen,
  onTogglePicker,
  onRun,
  onPin,
}: Props) => (
  <ScriptBand
    label="Suggested"
    group={group}
    count={group.suggested.length}
    hint="Pin the ones you run here."
    action={
      canPick ? (
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Pin a script of ${group.projectName}`}
          aria-expanded={isPickerOpen}
          onClick={onTogglePicker}
        >
          <Pin size={ICON_SIZE.row} aria-hidden />
          Pin a script
        </Button>
      ) : null
    }
  >
    {group.suggested.map((script) => {
      const record = scriptRunRecordFor({ runs, group, script });
      return (
        <SuggestedRow
          key={script.key}
          script={script}
          lastRun={
            record === null
              ? null
              : scriptOutcomeLabel({
                  status: record.status,
                  exitCode: record.result?.exitCode ?? null,
                })
          }
          blockedReason={group.isReady ? null : `${group.projectName} is still preparing`}
          onRun={() => onRun(script)}
          onPin={() => onPin(script)}
        />
      );
    })}
  </ScriptBand>
);
