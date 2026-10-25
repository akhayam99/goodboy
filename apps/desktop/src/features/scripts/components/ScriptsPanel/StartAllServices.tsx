import { Play } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import type { StartAllParams } from '../../hooks/useServiceStarts';
import { scriptRunRecordFor } from '../../scriptRunRecordFor';
import type { ScriptRunRecord } from '../../scripts';

type Props = {
  readonly group: SessionScriptGroup;
  readonly services: ReadonlyArray<RunnableScript>;
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly onStart: (params: StartAllParams) => void;
};

export const StartAllServices = ({ group, services, runs, onStart }: Props) => (
  <Button
    variant="ghost"
    size="xs"
    aria-label={`Start all services of ${group.projectName}`}
    disabled={services.every(
      (script) => scriptRunRecordFor({ runs, group, script })?.status === 'pending',
    )}
    onClick={() => onStart({ group, services })}
  >
    <Play size={ICON_SIZE.row} aria-hidden />
    Start all services
  </Button>
);
