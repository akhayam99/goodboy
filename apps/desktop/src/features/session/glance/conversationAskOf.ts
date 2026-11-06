import { glanceOf, type Glance } from './glanceOf';

type Params = {
  readonly glance: Glance;
  readonly askSentence: string | null;
};

export const conversationAskOf = ({ glance, askSentence }: Params): Glance =>
  askSentence === null ? glance : glanceOf({ state: 'waiting', sentence: askSentence });
