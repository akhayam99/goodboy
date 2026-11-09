import { STORY_QUESTION } from '../../scenes/story/storyContent';

type Params = {
  readonly answer: string;
};

const INTRO = 'Picked this up on Codex with the same issue and your answer.';
const RECOMMENDED = 'Return the original credit';

export const storyHandoffOf = ({ answer }: Params): string => {
  const known = Object.entries(STORY_QUESTION.outcomes).find(([option]) => option === answer);
  if (known === undefined) {
    return `${INTRO} You said "${answer}", so I wrote the plan around that.`;
  }
  if (answer !== RECOMMENDED) {
    return `${INTRO} You chose "${answer}". This plan still returns the original credit, so ask me to change it if you want a repeated webhook that ${known[1]}.`;
  }
  return `${INTRO} A repeated webhook ${known[1]}, so I wrote the plan around that.`;
};
