import type { ArtifactContextInventoryRow } from './artifactContextInventory';

export type ArtifactAttachment = Readonly<{
  id: string;
  fileName: string;
  mimeType: string;
  relPath: string;
}>;

type Params = Readonly<{
  attachments: ReadonlyArray<ArtifactAttachment>;
}>;

const ATTACHMENTS_SCOPE = 'this request, examples of how it should look';

export const artifactAttachmentsSection = ({ attachments }: Params): string | null => {
  if (attachments.length === 0) {
    return null;
  }
  const paths = attachments.map((attachment) => `- ${attachment.relPath}`).join('\n');
  return [
    '## attachments',
    `**Attached** (${ATTACHMENTS_SCOPE}) read each path with your Read tool before relying on it:\n${paths}`,
  ].join('\n\n');
};

export const attachmentsInventoryRow = ({ attachments }: Params): ArtifactContextInventoryRow => {
  if (attachments.length === 0) {
    return {
      id: 'attachments',
      label: 'attachments',
      summary: 'nothing attached',
      state: 'missing',
      detail: [],
    };
  }
  const noun = attachments.length === 1 ? 'file' : 'files';
  return {
    id: 'attachments',
    label: 'attachments',
    summary: `${attachments.length} ${noun} you attached, sent as paths for the agent to read`,
    state: 'included',
    detail: attachments.map((attachment) => attachment.fileName),
  };
};
