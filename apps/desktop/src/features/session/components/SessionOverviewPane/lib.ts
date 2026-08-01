import type { OpenQuestion, SessionStageInfo } from '@goodboy/types';

export type AttentionLens = 'agents' | 'workflows' | 'questions' | 'pr' | 'resolve';

export const resolveAttentionLens = (
  stage: SessionStageInfo,
  ctx: {
    readonly hasNonResolverStandalone: boolean;
    readonly hasWorkflow: boolean;
    readonly hasResolver: boolean;
    readonly unreadLens: 'agents' | 'resolve' | 'workflows' | null;
  },
): AttentionLens | null => {
  if (stage.stage !== 'attention') {
    return null;
  }
  if (stage.reason.startsWith('PR')) {
    return 'pr';
  }
  if (stage.reason.includes('question')) {
    return 'questions';
  }
  if (stage.reason === 'unread agent reply' && ctx.unreadLens != null) {
    return ctx.unreadLens;
  }
  if (ctx.hasNonResolverStandalone) {
    return 'agents';
  }
  if (ctx.hasResolver) {
    return 'resolve';
  }
  if (ctx.hasWorkflow) {
    return 'workflows';
  }
  return null;
};

export const selectOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
): ReadonlyArray<OpenQuestion> => questions.filter((q) => q.status === 'open');
