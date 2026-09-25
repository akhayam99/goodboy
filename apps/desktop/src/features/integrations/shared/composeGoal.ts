import { cutAtBoundary } from '../../../shared/utils/cutAtBoundary';
import { GOAL_BODY_CHAR_CAP } from './goalBodyCap';

export type GoalSource = {
  readonly noun: string;
  readonly reference: string;
  readonly url: string | null;
};

type Params = {
  readonly heading: string;
  readonly body: string;
  readonly source: GoalSource;
  readonly capChars?: number;
};

const fullSourceLine = ({ noun, reference, url }: GoalSource): string =>
  url !== null && url !== '' ? `Full ${noun}: ${reference} ${url}` : `Full ${noun}: ${reference}`;

export const composeGoal = ({
  heading,
  body,
  source,
  capChars = GOAL_BODY_CHAR_CAP,
}: Params): string => {
  const trimmed = body.trimEnd();
  if (trimmed.trim() === '') {
    return heading;
  }
  const cut = cutAtBoundary({ text: trimmed, capChars });
  if (cut.omittedChars === 0) {
    return `${heading}\n\n${cut.text}`;
  }
  return `${heading}\n\n${cut.text}\n\n${fullSourceLine(source)}`;
};
