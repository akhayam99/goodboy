import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import type { ScriptRunRecord } from './scripts';

type Params = {
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

export const scriptRunRecordFor = ({ runs, group, script }: Params): ScriptRunRecord | null => {
  const record = runs?.[script.key] ?? null;
  if (record === null || record.mountId === undefined) {
    return record;
  }
  return record.mountId === group.mountId ? record : null;
};
