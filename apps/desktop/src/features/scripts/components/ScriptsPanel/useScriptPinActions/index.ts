import { useAppStore } from '../../../../../store';
import type { RunnableScript, SessionScriptGroup } from '../../../buildSessionScripts';
import { scriptPinId } from '../../../scriptPinId';
import { useScriptPins } from '../../../hooks/useScriptPins';

type Params = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
};

type PinIdParams = {
  readonly group: SessionScriptGroup;
  readonly pinId: string;
};

type RowParams = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

export const useScriptPinActions = ({ groups }: Params) => {
  const toggleScriptPin = useAppStore((state) => state.toggleScriptPin);
  const reportError = useAppStore((state) => state.reportError);
  const pins = useScriptPins({ projectIds: groups.map((group) => group.projectId) });

  const isPinned = ({ group, script }: RowParams): boolean =>
    (pins[group.projectId] ?? []).includes(scriptPinId(script));
  const togglePinId = ({ group, pinId }: PinIdParams) =>
    void toggleScriptPin({ projectId: group.projectId, pinId }).catch((error: unknown) =>
      reportError({ title: "Couldn't pin the script", error }),
    );
  const togglePin = ({ group, script }: RowParams) =>
    togglePinId({ group, pinId: scriptPinId(script) });

  return { pins, isPinned, togglePinId, togglePin };
};
