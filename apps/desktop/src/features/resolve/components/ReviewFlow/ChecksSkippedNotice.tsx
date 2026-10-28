import { Notice } from '@goodboy/ui';
import { checksSkippedLine, checksSkippedOf } from '../../checksSkipped';

type Props = {
  readonly text: string;
};

export const ChecksSkippedNotice = ({ text }: Props) => {
  const skipped = checksSkippedOf({ text });
  if (skipped === null) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      placement="banner"
      role="status"
      title={checksSkippedLine({ skipped })}
    />
  );
};
