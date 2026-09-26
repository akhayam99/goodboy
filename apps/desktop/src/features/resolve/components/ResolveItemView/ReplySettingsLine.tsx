import { Settings } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionReplySettings } from '../../../../store/sessionReplySettings';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REVIEW_REPLIES_SECTION_ID, replySettingsSummary } from '../../replySettingsCopy';

type Props = {
  readonly sessionId: SessionId;
};

const openReplySettings = () =>
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'workspace', section: REVIEW_REPLIES_SECTION_ID },
    }),
  );

export const ReplySettingsLine = ({ sessionId }: Props) => {
  const summary = useAppStore((state) =>
    replySettingsSummary({ settings: sessionReplySettings({ state, sessionId }) }),
  );
  return (
    <p className="flex min-w-0 items-center gap-1 text-secondary text-faint-foreground">
      <span className="min-w-0 truncate">{summary}</span>
      <IconButton
        icon={Settings}
        iconSize={ICON_SIZE.row}
        label="Review reply settings"
        variant="ghost"
        className="p-0.5"
        onClick={openReplySettings}
      />
    </p>
  );
};
