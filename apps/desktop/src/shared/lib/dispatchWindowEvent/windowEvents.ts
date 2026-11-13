import type { SessionId } from '@goodboy/types';
import type { SettingsFocus } from '../../../features/settings/settingsFocus';

type Payload = Readonly<Record<string, unknown>>;

export type OpenLinkDetail = {
  readonly url: string;
  readonly sessionId?: SessionId | null;
  readonly place?: 'outside';
  readonly hasMetaKey?: boolean;
  readonly hasCtrlKey?: boolean;
};

export type OpenFolderDetail = {
  readonly path: string;
};

type DoorFlag = Partial<Record<'door', true>>;

export type OpenSettingsDetail = SettingsFocus & DoorFlag;

export type WindowEventDetails = {
  readonly 'goodboy:new-session': undefined;
  readonly 'goodboy:add-workspace': Payload | undefined;
  readonly 'goodboy:reveal-chat': Payload | undefined;
  readonly 'goodboy:open-workspace-switcher': undefined;
  readonly 'goodboy:open-command-palette': undefined;
  readonly 'goodboy:toggle-update-card': undefined;
  readonly 'goodboy:open-settings': OpenSettingsDetail;
  readonly 'goodboy:open-guide': Payload | undefined;
  readonly 'goodboy:open-link': OpenLinkDetail;
  readonly 'goodboy:open-folder': OpenFolderDetail;
  readonly 'goodboy:open-report-sheet': Payload | undefined;
  readonly 'goodboy:open-notifications-studio': Payload | undefined;
  readonly 'goodboy:open-notifications': undefined;
  readonly 'goodboy:open-pair-device': Payload | undefined;
  readonly 'goodboy:open-impact-studio': Payload | undefined;
  readonly 'goodboy:open-inbox': Payload | undefined;
  readonly 'goodboy:open-workflow-studio': Payload | undefined;
  readonly 'goodboy:open-changelog': Payload | undefined;
  readonly 'goodboy:open-plan-studio': Payload;
  readonly 'goodboy:open-start-run': Payload | undefined;
  readonly 'goodboy:edit-session-spend-limit': Payload;
  readonly 'goodboy:toggle-step-routing': Payload;
  readonly 'goodboy:open-model-picker': undefined;
  readonly 'goodboy:open-permission-picker': undefined;
  readonly 'goodboy:workflow-step-started': Payload;
  readonly 'goodboy:script-ended': Payload;
  readonly 'goodboy:onboarding-progress': undefined;
  readonly 'goodboy:open-onboarding-wizard': Payload | undefined;
  readonly 'goodboy:credential-recheck': undefined;
  readonly 'goodboy:needs-you-feedback': Payload;
};

export type WindowEventName = keyof WindowEventDetails;
