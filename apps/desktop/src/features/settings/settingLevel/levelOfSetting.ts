import type { OverrideSettings } from '@goodboy/types';
import { OVERRIDE_REACH } from './overrideReach';

export type SettingLevel = 'global' | 'workspace' | 'project' | 'session';

type Params = {
  readonly key: keyof OverrideSettings;
  readonly workspaceOverride: OverrideSettings | null;
  readonly projectOverride: OverrideSettings | null;
  readonly sessionOverride: OverrideSettings | null;
};

type HeldParams = {
  readonly layer: OverrideSettings | null;
  readonly key: keyof OverrideSettings;
};

const isHeld = ({ layer, key }: HeldParams): boolean => layer !== null && layer[key] != null;

export const levelOfSetting = ({
  key,
  workspaceOverride,
  projectOverride,
  sessionOverride,
}: Params): SettingLevel => {
  const reach: ReadonlyArray<string> = OVERRIDE_REACH[key];
  if (reach.includes('session') && isHeld({ layer: sessionOverride, key })) {
    return 'session';
  }
  if (reach.includes('project') && isHeld({ layer: projectOverride, key })) {
    return 'project';
  }
  return isHeld({ layer: workspaceOverride, key }) ? 'workspace' : 'global';
};
