import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { BrowserStudioBody } from './BrowserStudioBody';

type Props = {
  readonly sessionId: SessionId | null;
  readonly tabId: string | null;
  readonly onClose: () => void;
};

export const BrowserStudio = ({ sessionId, tabId, onClose }: Props) => (
  <StudioShell
    icon={CONCEPT_ICONS.browser}
    tone={CONCEPT_TONE.browser}
    title="Browser"
    closeLabel="Close browser"
    onClose={onClose}
  >
    {() => <BrowserStudioBody sessionId={sessionId} tabId={tabId} />}
  </StudioShell>
);
