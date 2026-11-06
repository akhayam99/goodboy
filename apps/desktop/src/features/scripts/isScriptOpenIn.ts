import type { MountId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';

type OpenPayload = {
  readonly scriptKey: string;
  readonly mountId: MountId | null;
};

type Params = {
  readonly openPayload: OpenPayload | null;
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

export const isScriptOpenIn = ({ openPayload, group, script }: Params): boolean =>
  openPayload !== null &&
  openPayload.scriptKey === script.key &&
  (openPayload.mountId === null || openPayload.mountId === group.mountId);
