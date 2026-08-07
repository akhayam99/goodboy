const CONNECT_HINT = 'Connect GitHub to send the full text.';

type TruncationNoticeParams = {
  readonly titleTruncated: boolean;
  readonly notesTruncated: boolean;
};

export const truncationNotice = ({
  titleTruncated,
  notesTruncated,
}: TruncationNoticeParams): string | null => {
  if (titleTruncated && notesTruncated) {
    return `Title and notes trimmed to fit the GitHub link. ${CONNECT_HINT}`;
  }
  if (titleTruncated) {
    return `Title trimmed to fit the GitHub link. ${CONNECT_HINT}`;
  }
  if (notesTruncated) {
    return `Notes trimmed to fit the GitHub link. ${CONNECT_HINT}`;
  }
  return null;
};
