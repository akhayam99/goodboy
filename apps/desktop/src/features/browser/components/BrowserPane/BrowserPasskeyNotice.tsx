import { KeyRound } from 'lucide-react';
import { Button, Notice } from '@goodboy/ui';
import type { BrowserPaneModel } from '../../types';

type Props = {
  readonly model: BrowserPaneModel;
};

export const BrowserPasskeyNotice = ({ model }: Props) => {
  if (!model.isPasskeyBlocked) {
    return null;
  }
  return (
    <div className="px-2">
      <Notice
        tone="info"
        placement="banner"
        role="status"
        icon={KeyRound}
        title="Passkeys don't work in Goodboy's browser"
        body="Finish in your browser, or choose another way on this page."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={model.dismissPasskey}>
              Dismiss
            </Button>
            <Button variant="secondary" size="sm" onClick={model.openOutside}>
              Open in your browser
            </Button>
          </>
        }
      />
    </div>
  );
};
