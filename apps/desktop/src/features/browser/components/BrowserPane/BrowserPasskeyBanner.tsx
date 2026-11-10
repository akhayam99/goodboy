import { KeyRound } from 'lucide-react';
import { Button, Notice } from '@goodboy/ui';
import { passkeyBannerText } from '../../passkeyBannerText';
import type { BrowserPaneModel } from '../../types';

type Props = {
  readonly model: BrowserPaneModel;
};

export const BrowserPasskeyBanner = ({ model }: Props) => {
  if (model.passkeyHost === null) {
    return null;
  }
  const text = passkeyBannerText({ host: model.passkeyHost });
  return (
    <section aria-label={text.region} className="px-2">
      <Notice
        tone="info"
        placement="banner"
        icon={KeyRound}
        role="status"
        title={text.title}
        body={text.body}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={model.dismissPasskey}>
              {text.dismiss}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={model.address === ''}
              onClick={model.openOutside}
            >
              {text.open}
            </Button>
          </>
        }
      />
    </section>
  );
};
