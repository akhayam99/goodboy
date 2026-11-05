type TextParams = {
  readonly revision: number;
};

type ReplyParams = {
  readonly text: string;
};

const APPROVED_PREFIX = 'Approved plan v';

const APPROVED_PATTERN = /^Approved plan v(\d{1,6})\.?$/;

export const approvedPlanTextOf = ({ revision }: TextParams): string =>
  `${APPROVED_PREFIX}${revision}.`;

export const approvedPlanLabelOf = ({ text }: ReplyParams): string | null => {
  const match = APPROVED_PATTERN.exec(text.trim());
  return match === null ? null : `${APPROVED_PREFIX}${match[1] ?? ''}`;
};
