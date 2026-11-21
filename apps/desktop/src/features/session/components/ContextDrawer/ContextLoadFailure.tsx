import { ErrorStrip } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly onRetry: () => void;
};

const NOTHING_CHANGED = 'Nothing in the session was changed.';

export const ContextLoadFailure = ({ title, onRetry }: Props) => (
  <ErrorStrip labels={[title.toLowerCase()]} error={new Error(NOTHING_CHANGED)} onRetry={onRetry} />
);
