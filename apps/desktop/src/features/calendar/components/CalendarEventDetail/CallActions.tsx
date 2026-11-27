import { useState } from 'react';
import { Button, copyToClipboard, InlineConfirm } from '@goodboy/ui';
import { Link } from '@goodboy/ui/icons';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { joinCall } from '../../joinCall';
import { linkHostOf } from '../../linkHostOf';

type Props = {
  readonly link: string;
  readonly isTrusted: boolean;
};

const JOIN = actionButtonLookOf({ verb: 'Join call', variant: 'primary' });
const COPY = actionButtonLookOf({ verb: 'Copy link', variant: 'secondary' });
const COPY_KEY = 'copy-link';

export const CallActions = ({ link, isTrusted }: Props) => {
  const [isHostShown, setIsHostShown] = useState(false);
  const { pendingKeys, run } = usePendingAction();
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
          isBusy={pendingKeys.has(COPY_KEY)}
          onClick={() =>
            void run({
              key: COPY_KEY,
              failureTitle: "Couldn't copy the link",
              task: () => copyToClipboard({ text: link }),
            })
          }
        >
          Copy link
        </Button>
      </div>
      {isHostShown ? (
        <InlineConfirm
          role="primary"
          icon={<Link aria-hidden />}
          title={`Open ${host}?`}
          description="This link isn't from a call app Goodboy knows."
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
