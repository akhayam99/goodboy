const DRAFT_GOAL_LIMIT = 280;

type Params = {
  readonly text: string;
};

export const draftGoalText = ({ text }: Params): string => {
  const flat = text.trim().replace(/\s+/g, ' ');
  const end = flat.search(/[.!?](\s|$)/);
  const sentence = end < 0 ? flat : flat.slice(0, end + 1);
  if (sentence.length <= DRAFT_GOAL_LIMIT) {
    return sentence;
  }
  return `${sentence.slice(0, DRAFT_GOAL_LIMIT - 1).trimEnd()}…`;
};
