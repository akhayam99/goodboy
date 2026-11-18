import { Button } from '@goodboy/ui';
import { StartForm } from '../../../../../features/session/components/StartForm/StartForm';

type Props = {
  readonly isProviderMissing: boolean;
};

export const StartFailureScene = ({ isProviderMissing }: Props) => (
  <div data-shot className="flex w-[680px] flex-col gap-4 bg-background p-6 text-foreground">
    <p className="text-body">Make payments-api safe to retry.</p>
    <StartForm
      plan={null}
      hint={null}
      settings={[]}
      note={null}
      error={
        isProviderMissing
          ? 'Connect Claude, Codex, Cursor or Gemini to use the Lead.'
          : 'The payments-api project could not be opened.'
      }
      reason={null}
      reasonId="u34-start-reason"
    >
      <Button variant="ghost">Discard</Button>
      <Button variant={isProviderMissing ? 'secondary' : 'primary'}>Retry</Button>
    </StartForm>
  </div>
);
