import { RotateCcw, Smartphone } from 'lucide-react';
import { Button, FieldRow, KbdPill, XIcon } from '@goodboy/ui';
import { reopenWizard } from '../../../onboarding/onboarding-store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { openReportSheet } from '../../../bug-report/openReportSheet';
import { openUrl } from '../../../../shared/lib/editor';
import { SOCIAL_LINKS } from '../../../../shared/lib/productLinks';

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
      <FieldRow
        label="First-run setup"
        help="Walk through providers, project, code host and tasks again."
      >
        <Button variant="secondary" size="sm" onClick={closeThen(reopenWizard)}>
          <RotateCcw size={ICON_SIZE.control} aria-hidden /> Run setup again
        </Button>
      </FieldRow>

      <FieldRow label="Guide" help="How Goodboy works, from setup to cleanup.">
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

      <FieldRow
        label="Report a bug"
        help="A line from you, the rest attached. You see all of it before it goes."
      >
        <Button variant="secondary" size="sm" onClick={() => openReportSheet()}>
          <CONCEPT_ICONS.reportIssue size={ICON_SIZE.control} aria-hidden /> Report a bug
          <KbdPill>{shortcutGlyphs('report.open')}</KbdPill>
        </Button>
      </FieldRow>

      <FieldRow label="Follow Goodboy" help="Release news and what is coming next.">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void openUrl(SOCIAL_LINKS.x);
          }}
        >
          <XIcon size={ICON_SIZE.control} aria-hidden /> Follow on X
        </Button>
      </FieldRow>
    </div>
  );
};
