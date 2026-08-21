import type { GhRunner } from '@goodboy/core';
import type { BugReportImage } from '../../../../store/slices/bugReportDraft/state';
import { issueAssetPath } from './issueAssetPath';
import { stageBugReportUploadPayloads, type StagedUploadPayload } from './stageImages';

export type UploadedIssueImage = {
  readonly fileName: string;
  readonly url: string;
};

type Params = {
  readonly runner: GhRunner;
  readonly slug: string;
  readonly dir: string;
  readonly images: ReadonlyArray<BugReportImage>;
  readonly now?: Date;
};

type PutParams = {
  readonly runner: GhRunner;
  readonly slug: string;
  readonly payload: StagedUploadPayload;
  readonly path: string;
};

const putIssueAsset = async ({
  runner,
  slug,
  payload,
  path,
}: PutParams): Promise<string | null> => {
  const result = await runner.run(
    [
      'api',
      '--method',
      'PUT',
      `repos/${slug}/contents/${path}`,
      '-f',
      `message=Add ${path}`,
      '-F',
      `content=@${payload.payloadPath}`,
      '--jq',
      '.content.download_url',
    ],
    {},
  );
  if (result.exitCode !== 0) {
    return null;
  }
  const url = result.stdout.trim();
  return url.startsWith('https://') ? url : null;
};

export const uploadIssueImages = async ({
  runner,
  slug,
  dir,
  images,
  now = new Date(),
}: Params): Promise<ReadonlyArray<UploadedIssueImage> | null> => {
  if (images.length === 0) {
    return null;
  }
  try {
    const payloads = await stageBugReportUploadPayloads({ dir, images });
    const uploaded: Array<UploadedIssueImage> = [];
    for (const [index, payload] of payloads.entries()) {
      const path = issueAssetPath({ fileName: payload.fileName, index, now });
      const url = await putIssueAsset({ runner, slug, payload, path });
      if (url == null) {
        return null;
      }
      uploaded.push({ fileName: payload.fileName, url });
    }
    return uploaded.length === images.length ? uploaded : null;
  } catch {
    return null;
  }
};
