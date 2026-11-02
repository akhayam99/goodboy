import { Button } from '@goodboy/ui';
import { StartForm } from '../../../../../features/session/components/StartForm/StartForm';

type Props = {
  readonly isProviderMissing: boolean;
};

export const StartFailureScene = ({ isProviderMissing }: Props) => (
  <div data-shot className="w-[680px] bg-background p-6 text-foreground">
    <StartForm
      kind={null}
      hint={null}
      hasPresets={false}
      isDisabled={false}
      onKind={null}
      fields={<p className="text-body">Make payments-api safe to retry.</p>}
      settings={[]}
      note={null}
      error={
        isProviderMissing
          ? 'Connect Claude, Codex, Cursor or Gemini to use Auto.'
          : 'The payments-api project could not be opened.'
      }
      reason={null}
      reasonId="u34-start-reason"
    >
      <Button variant="ghost">Discard</Button>
      <Button>Retry</Button>
    </StartForm>
  </div>
);
