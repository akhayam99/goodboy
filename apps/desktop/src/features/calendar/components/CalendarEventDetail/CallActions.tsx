import { useState } from 'react';
import { Button, copyToClipboard, InlineConfirm } from '@goodboy/ui';
import { Link } from '@goodboy/ui/icons';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { useAppStore } from '../../../../store';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { joinCall } from '../../joinCall';
import { linkHostOf } from '../../linkHostOf';

type Props = {
  readonly link: string;
  readonly isTrusted: boolean;
};

const JOIN = actionButtonLookOf({ verb: 'Join call', variant: 'primary' });
const COPY = actionButtonLookOf({ verb: 'Copy link', variant: 'secondary' });

type CopyParams = {
  readonly link: string;
};

const copyLink = async ({ link }: CopyParams): Promise<void> => {
  try {
    await copyToClipboard({ text: link });
  } catch (error) {
    await useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't copy the link", error });
  }
};

export const CallActions = ({ link, isTrusted }: Props) => {
  const [isHostShown, setIsHostShown] = useState(false);
  const host = linkHostOf({ link }) ?? link;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant={JOIN.variant}
          intent={JOIN.intent}
          size="sm"
          onClick={() => {
            if (isTrusted) {
              joinCall({ link });
              return;
            }
            setIsHostShown(true);
          }}
        >
          Join call
        </Button>
        <Button
          variant={COPY.variant}
          intent={COPY.intent}
          size="sm"
          onClick={() => void copyLink({ link })}
        >
          Copy link
        </Button>
      </div>
      {isHostShown ? (
        <InlineConfirm
          role="primary"
          icon={<Link aria-hidden />}
          title={`Open ${host}?`}
          description="This link is not from a call app Goodboy knows."
          confirmLabel="Open link"
          onConfirm={() => {
            setIsHostShown(false);
            joinCall({ link });
          }}
          onCancel={() => setIsHostShown(false)}
        />
      ) : null}
    </div>
  );
};
