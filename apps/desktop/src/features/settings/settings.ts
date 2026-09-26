import { invoke } from '@tauri-apps/api/core';
import type { BugReportImage } from '../../store/slices/bugReportDraft/state';

export const SETTING_EDITOR_BINARY = 'editor.binary';
export const SETTING_DEFAULT_EDITOR = 'editor.default';
export const SETTING_LAST_WORKSPACE_ID = 'last.workspace_id';
export const SETTING_LAST_SESSION_ID = 'last.session_id';
export const SETTING_REOPEN_LAST = 'launch.reopen_last';
export const SETTING_HIDDEN_MODELS = 'providers.hiddenModels';
export const SETTING_UPDATER_AUTO_DOWNLOAD = 'updater.autoDownload';
export const SETTING_UPDATER_SNOOZED_VERSION = 'updater.snoozedVersion';
export const SETTING_UPDATER_SNOOZED_AT = 'updater.snoozedAt';
export const DEFAULT_EDITOR_BINARY = 'code';
export const DEFAULT_BRANCH_PREFIX = 'goodboy';

type StageImagesParams = {
  readonly images: ReadonlyArray<BugReportImage>;
};

const base64FromDataUrl = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
};

export type StagedBugReportImage = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly path: string;
};

export type StagedBugReport = {
  readonly dir: string;
  readonly images: ReadonlyArray<StagedBugReportImage>;
};

export const stageBugReportImages = async ({
  images,
}: StageImagesParams): Promise<StagedBugReport | null> => {
  if (images.length === 0) {
    return null;
  }
  return invoke<StagedBugReport>('bug_report_stage_images', {
    images: images.map((image) => ({
      fileName: image.fileName,
      mimeType: image.mimeType,
      dataBase64: base64FromDataUrl(image.dataUrl),
    })),
  });
};

type RevealParams = {
  readonly dir: string;
};

export const revealBugReportImages = async ({ dir }: RevealParams): Promise<void> => {
  await invoke('bug_report_reveal_images', { dir });
};

export const discardBugReportImages = async ({ dir }: RevealParams): Promise<void> => {
  try {
    await invoke('bug_report_discard_images', { dir });
  } catch {
    return;
  }
};
