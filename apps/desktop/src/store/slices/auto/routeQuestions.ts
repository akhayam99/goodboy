import { isAutoChildAgent, type Database } from '@goodboy/db';

export type QuestionRoute = 'open_questions' | 'tree';

export const QUESTION_MARKER = '<<ctx-question';

export type RouteQuestionsParams = Readonly<{
  db: Database;
  agentId: string;
  assistantText: string;
}>;

export const routeQuestions = async ({
  db,
  agentId,
  assistantText,
}: RouteQuestionsParams): Promise<QuestionRoute> => {
  if (!assistantText.includes(QUESTION_MARKER)) {
    return 'open_questions';
  }
  return (await isAutoChildAgent({ db, agentId })) ? 'tree' : 'open_questions';
};
