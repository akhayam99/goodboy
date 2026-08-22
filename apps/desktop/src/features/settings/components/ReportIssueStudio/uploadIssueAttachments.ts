import type { GhRunner } from '@goodboy/core';
import type { StagedBugReportImage } from './stageImages';

const UPLOAD_ENDPOINT = 'https://uploads.github.com/user-attachments/assets';

const ATTACHMENT_URL_PREFIX = 'https://github.com/user-attachments/assets/';

const UPLOAD_TIMEOUT_MS = 60_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type UploadedIssueImage = {
  readonly name: string;
  readonly url: string;
};

const imageMimeType = ({ image }: { readonly image: StagedBugReportImage }): string => {
  if (image.mimeType.startsWith('image/')) {
    return image.mimeType;
  }
  const extension = image.fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'image/png';
};

const parseAttachmentUrl = ({ stdout }: { readonly stdout: string }): string | null => {
  try {
    const payload: unknown = JSON.parse(stdout);
    if (typeof payload !== 'object' || payload === null || !('url' in payload)) {
      return null;
    }
    const { url } = payload as { readonly url: unknown };
    return typeof url === 'string' && url.startsWith(ATTACHMENT_URL_PREFIX) ? url : null;
  } catch {
    return null;
  }
};

type RepositoryIdParams = {
  readonly runner: GhRunner;
  readonly repo: string;
};

const repositoryId = async ({ runner, repo }: RepositoryIdParams): Promise<string | null> => {
  const result = await runner.run(['api', `repos/${repo}`, '--jq', '.id'], {});
  if (result.exitCode !== 0) {
    return null;
  }
  const id = result.stdout.trim();
  return /^[0-9]+$/.test(id) ? id : null;
};

type Params = {
  readonly runner: GhRunner;
  readonly repo: string;
  readonly images: ReadonlyArray<StagedBugReportImage>;
};

export const uploadIssueAttachments = async ({
  runner,
  repo,
  images,
}: Params): Promise<ReadonlyArray<UploadedIssueImage> | null> => {
  if (images.length === 0) {
    return null;
  }
  try {
    const id = await repositoryId({ runner, repo });
    if (id == null) {
      return null;
    }
    const uploaded: UploadedIssueImage[] = [];
    for (const image of images) {
      const mimeType = imageMimeType({ image });
      const query = new URLSearchParams({
        name: image.fileName,
        content_type: mimeType,
        repository_id: id,
      });
      const result = await runner.run(
        [
          'api',
          '--method',
          'POST',
          `${UPLOAD_ENDPOINT}?${query.toString()}`,
          '-H',
          `Content-Type: ${mimeType}`,
          '-H',
          'Accept: application/json',
          '--input',
          image.path,
        ],
        { timeoutMs: UPLOAD_TIMEOUT_MS },
      );
      if (result.exitCode !== 0) {
        return null;
      }
      const url = parseAttachmentUrl({ stdout: result.stdout });
      if (url == null) {
        return null;
      }
      uploaded.push({ name: image.fileName, url });
    }
    return uploaded;
  } catch {
    return null;
  }
};
