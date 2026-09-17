import { extractMarkers } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import { appendArtifactProvenanceOmission, loadArtifactProvenance } from './artifactProvenance';

const QUESTION_MARKER = '<<ctx-question';

const QUESTION_CLIP = 160;

type NoteParams = Readonly<{
  question: string;
  recommended: string | null;
}>;

const clip = ({ text }: Readonly<{ text: string }>): string => {
  const collapsed = redactSecrets({ text }).replace(/\s+/g, ' ').trim();
  return collapsed.length <= QUESTION_CLIP ? collapsed : `${collapsed.slice(0, QUESTION_CLIP)}...`;
};

export const artifactAssumptionNote = ({ question, recommended }: NoteParams): string => {
  const asked = clip({ text: question });
  if (recommended === null || recommended.trim().length === 0) {
    return `asked "${asked}" and assumed its own answer, with no recommendation on record`;
  }
  return `asked "${asked}" and assumed "${clip({ text: recommended })}"`;
};

type Params = Readonly<{
  agentId: AgentId;
  assistantText: string;
}>;

export const recordArtifactAssumptions = async ({
  agentId,
  assistantText,
}: Params): Promise<number> => {
  if (!assistantText.includes(QUESTION_MARKER)) {
    return 0;
  }
  const { questions } = extractMarkers(assistantText);
  if (questions.length === 0) {
    return 0;
  }
  const provenance = await loadArtifactProvenance(agentId).catch(() => null);
  if (provenance === null) {
    return 0;
  }
  let recorded = 0;
  for (const question of questions) {
    await appendArtifactProvenanceOmission({
      agentId,
      note: artifactAssumptionNote({
        question: question.text,
        recommended: question.recommendedAnswer,
      }),
    }).catch(() => undefined);
    recorded += 1;
  }
  return recorded;
};
