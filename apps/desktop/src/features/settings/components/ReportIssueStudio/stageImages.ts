import { invoke } from '@tauri-apps/api/core';
import type { BugReportImage } from '../../../../store/slices/bugReportDraft/state';

type Params = {
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

export const stageBugReportImages = async ({ images }: Params): Promise<StagedBugReport | null> => {
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
