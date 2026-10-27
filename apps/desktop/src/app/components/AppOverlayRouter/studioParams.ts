import type { Workspace } from '@goodboy/types';
import type { SettingsScopeChange } from '../../../features/settings/settingsFocus';
import type { ImpactScope } from '../../../features/impact/lib';
import type { InboxStudioFocus, StudioPlace } from '../../../store';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import type { StudioPlacement } from '../StudioFrame/studioPlacement';

export type OpenChangelogScreenParams = {
  readonly screen: ChangelogScreen;
};

type StudioParams = {
  readonly overlay: StudioPlace;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onInboxFocusChange: (focus: InboxStudioFocus) => void;
  readonly onImpactScopeChange: (scope: ImpactScope) => void;
  readonly onOpenChangelogScreen: (params: OpenChangelogScreenParams) => void;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly placement?: StudioPlacement;
  readonly settingsColumnSlot?: HTMLElement | null;
};

export type AppStudioProps = Omit<StudioParams, 'overlay'> & {
  readonly overlay: StudioPlace | null;
};

export type RenderStudioParams = Omit<StudioParams, 'placement'> & {
  readonly isInColumnShell: boolean;
};
