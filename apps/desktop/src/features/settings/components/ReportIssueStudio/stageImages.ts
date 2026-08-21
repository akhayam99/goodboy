import { invoke } from '@tauri-apps/api/core';
import type { BugReportImage } from '../../../../store/slices/bugReportDraft/state';

type Params = {
  readonly images: ReadonlyArray<BugReportImage>;
};

const base64FromDataUrl = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
};

export const stageBugReportImages = async ({ images }: Params): Promise<string | null> => {
  if (images.length === 0) {
    return null;
  }
  return invoke<string>('bug_report_stage_images', {
    images: images.map((image) => ({
      fileName: image.fileName,
      dataBase64: base64FromDataUrl(image.dataUrl),
    })),
  });
};

type DirParams = {
  readonly dir: string;
};

export const revealBugReportImages = async ({ dir }: DirParams): Promise<void> => {
  await invoke('bug_report_reveal_images', { dir });
};

export type StagedUploadPayload = {
  readonly fileName: string;
  readonly payloadPath: string;
};

type StageUploadParams = DirParams & Params;

export const stageBugReportUploadPayloads = async ({
  dir,
  images,
}: StageUploadParams): Promise<ReadonlyArray<StagedUploadPayload>> =>
  invoke<ReadonlyArray<StagedUploadPayload>>('bug_report_stage_upload_payloads', {
    dir,
    images: images.map((image) => ({
      fileName: image.fileName,
      dataBase64: base64FromDataUrl(image.dataUrl),
    })),
  });

export const discardBugReportImages = async ({ dir }: DirParams): Promise<void> => {
  try {
    await invoke('bug_report_discard_images', { dir });
  } catch {
    return;
  }
};
