type Params = {
  readonly label: string;
};

const RANGE_MARK = '@@';

const CONTEXT_MARK = ' · in ';

export const hunkContextOf = ({ label }: Params): string => {
  const named = label.indexOf(CONTEXT_MARK);
  if (named !== -1) {
    return label.slice(named + CONTEXT_MARK.length).trim();
  }
  if (!label.startsWith(RANGE_MARK)) {
    return '';
  }
  const end = label.indexOf(RANGE_MARK, RANGE_MARK.length);
  return end === -1 ? '' : label.slice(end + RANGE_MARK.length).trim();
};
