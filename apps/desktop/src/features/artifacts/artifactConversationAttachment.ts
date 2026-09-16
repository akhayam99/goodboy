import type { SessionArtifact } from '@goodboy/types';

type Params = Readonly<{
  draft: string;
  artifact: SessionArtifact;
}>;

const FENCE = '```';

const artifactAttachmentLabel = ({ artifact }: { readonly artifact: SessionArtifact }) =>
  `${artifact.title} (${artifact.kind}, rev ${artifact.revision})`;

export const appendArtifactAttachment = ({ draft, artifact }: Params): string => {
  const language = artifact.sourceFormat === 'json' ? 'json' : 'markdown';
  const block = [
    `attached ${artifact.kind}: ${artifactAttachmentLabel({ artifact })}`,
    'this is the content as it stands in Goodboy right now, edits included.',
    `${FENCE}${language}`,
    artifact.sourceText,
    FENCE,
  ].join('\n');
  const head = draft.replace(/\s+$/u, '');
  return head.length === 0 ? `${block}\n` : `${head}\n\n${block}\n`;
};
