import { PROVIDER_IDS } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { EFFORT_LEVELS } from '../../../chat/utils/chat-constants';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import { storedText } from '../../../../shared/lib/storedText';
import type { AnswerIntent, QuestionDraft } from './useOpenQuestions';

type Drafts = Readonly<Record<string, QuestionDraft>>;

type ValueParams = Readonly<{
  value: unknown;
}>;

type WriteParams = Readonly<{
  drafts: Drafts;
}>;

const NO_DRAFTS: Drafts = {};

const intentOf = ({ value }: ValueParams): AnswerIntent | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value['kind'] === 'person') {
    return { kind: 'person' };
  }
  const routing = value['routing'];
  if (value['kind'] !== 'agent' || typeof value['hints'] !== 'string' || !isRecord(routing)) {
    return null;
  }
  const provider =
    routing['provider'] === '' ? '' : PROVIDER_IDS.find((id) => id === routing['provider']);
  const effort = EFFORT_LEVELS.find((level) => level === routing['effort']);
  if (provider === undefined || effort === undefined || typeof routing['model'] !== 'string') {
    return null;
  }
  return {
    kind: 'agent',
    hints: value['hints'],
    routing: { provider, model: routing['model'], effort },
  };
};

const questionDraftOf = ({ value }: ValueParams): QuestionDraft | null => {
  if (!isRecord(value)) {
    return null;
  }
  const suggestions = value['selectedSuggestions'];
  const answerIntent = intentOf({ value: value['answerIntent'] });
  if (
    !Array.isArray(suggestions) ||
    !suggestions.every((entry) => typeof entry === 'string') ||
    typeof value['customAnswer'] !== 'string' ||
    typeof value['showCustomField'] !== 'boolean' ||
    answerIntent === null
  ) {
    return null;
  }
  return {
    selectedSuggestions: suggestions,
    customAnswer: value['customAnswer'],
    showCustomField: value['showCustomField'],
    answerIntent,
  };
};

const KEY = `${STORAGE_PREFIXES.questionDraft}all`;

const draftsOf = ({ value }: ValueParams): Drafts => {
  if (!isRecord(value)) {
    return NO_DRAFTS;
  }
  return Object.entries(value).reduce<Record<string, QuestionDraft>>((acc, [id, entry]) => {
    const draft = questionDraftOf({ value: entry });
    return draft === null ? acc : { ...acc, [id]: draft };
  }, {});
};

export const storedQuestionDrafts = {
  read: (): Drafts => {
    const raw = storedText.read({ key: KEY });
    if (raw === '') {
      return NO_DRAFTS;
    }
    try {
      return draftsOf({ value: JSON.parse(raw) });
    } catch {
      return NO_DRAFTS;
    }
  },
  write: ({ drafts }: WriteParams): void =>
    storedText.write({
      key: KEY,
      text: Object.keys(drafts).length === 0 ? '' : JSON.stringify(drafts),
    }),
};
