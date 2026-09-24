import { RotateCcw, Smartphone } from 'lucide-react';
import { Button, FieldRow } from '@goodboy/ui';
import { reopenWizard } from '../../../onboarding/onboarding-store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';

type Props = {
  readonly requestClose: () => void;
};

export const AppHelpSection = ({ requestClose }: Props) => {
  const closeThen = (action: () => void) => () => {
    requestClose();
    action();
  };

  return (
    <div className="flex flex-col">
      <FieldRow label="First-run setup" help="Walk through providers, workspace and profile again.">
        <Button variant="secondary" size="sm" onClick={closeThen(reopenWizard)}>
          <RotateCcw size={ICON_SIZE.control} aria-hidden /> Run setup again
        </Button>
      </FieldRow>

      <FieldRow label="Guide" help="How the board, sessions and agents fit together.">
        <Button
          variant="secondary"
          size="sm"
          onClick={closeThen(() => window.dispatchEvent(new CustomEvent('goodboy:open-guide')))}
        >
          <CONCEPT_ICONS.guide size={ICON_SIZE.control} aria-hidden /> Open guide
        </Button>
      </FieldRow>

      <FieldRow label="iPhone" help="Follow your sessions from your phone.">
        <Button
          variant="secondary"
          size="sm"
          onClick={closeThen(() =>
            window.dispatchEvent(new CustomEvent('goodboy:open-pair-device')),
          )}
        >
          <Smartphone size={ICON_SIZE.control} aria-hidden /> Pair your iPhone
        </Button>
      </FieldRow>

      <FieldRow label="Feedback" help="You see exactly what gets sent before you send it.">
        <Button
          variant="secondary"
          size="sm"
          onClick={closeThen(() =>
            window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT)),
          )}
        >
          <CONCEPT_ICONS.reportIssue size={ICON_SIZE.control} aria-hidden /> Report an issue
        </Button>
      </FieldRow>
    </div>
  );
};
