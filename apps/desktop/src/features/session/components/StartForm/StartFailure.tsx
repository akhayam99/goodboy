import { Button } from '@goodboy/ui';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { openSettings } from '../../../settings/openSettings';

type Props = {
  readonly error: string;
};

const PROVIDER_MISSING = 'Connect Claude, Codex, Cursor or Gemini to use Auto.';

export const StartFailure = ({ error }: Props) => {
  const copy = useCopyText();
  const isProviderMissing = error === PROVIDER_MISSING;
  return (
    <div role="alert" className="flex min-w-0 flex-col gap-2 rounded-md bg-subtle p-3">
      <p className="text-body text-danger">{error}</p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (isProviderMissing) {
              openSettings({ scope: 'providers' });
              return;
            }
            void copy({ text: error });
          }}
        >
          {isProviderMissing ? 'Connect a provider' : 'Copy details'}
        </Button>
      </div>
    </div>
  );
};
