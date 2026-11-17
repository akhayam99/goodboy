import { CircleAlert } from '@goodboy/ui/icons';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { openConnection } from '../../../connections/openConnection';

type Props = {
  readonly error: string;
};

const PROVIDER_MISSING = 'Connect Claude, Codex, Cursor or Gemini to use the Lead.';

export const StartFailure = ({ error }: Props) => {
  const copy = useCopyText();
  const isProviderMissing = error === PROVIDER_MISSING;
  return (
    <div role="alert" className="flex min-w-0 flex-col gap-2 rounded-md bg-subtle p-3">
      <p className="flex items-start gap-2 text-ui text-danger">
        <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        {error}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isProviderMissing ? 'primary' : 'secondary'}
          onClick={() => {
            if (isProviderMissing) {
              openConnection({ focus: null });
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
