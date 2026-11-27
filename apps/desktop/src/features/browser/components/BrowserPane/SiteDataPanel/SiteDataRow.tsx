import { useState } from 'react';
import { Trash2 } from '@goodboy/ui/icons';
import { Button, Chip, ICON_SIZE, InlineConfirm } from '@goodboy/ui';
import { actionIntentOf } from '../../../../actions/actionIntentOf';
import type { BrowserSiteRecord } from '../../../types';
import { BrowserFavicon } from '../BrowserFavicon';
import { siteKindsText } from './siteKindsText';

type NameParams = {
  readonly name: string;
};

type Props = {
  readonly record: BrowserSiteRecord;
  readonly onClear: (params: NameParams) => Promise<void>;
};

const TIE_LABEL = {
  site: 'This tab',
  signIn: 'Sign-in for this tab',
} as const satisfies Record<NonNullable<BrowserSiteRecord['tie']>, string>;

const CLEAR_VERB = 'Clear site data';

export const SiteDataRow = ({ record, onClear }: Props) => {
  const [isAsking, setIsAsking] = useState(false);
  const site = record.name;
  if (isAsking) {
    return (
      <InlineConfirm
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title={`Clear ${site}?`}
        description="Signs you out of every app that uses it."
        confirmLabel="Clear"
        onConfirm={async () => {
          await onClear({ name: site });
          setIsAsking(false);
        }}
        onCancel={() => setIsAsking(false)}
      />
    );
  }
  return (
    <div data-site-record={site} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2">
      <BrowserFavicon url={`http://${site}`} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{site}</span>
        <span className="truncate text-meta text-muted-foreground">
          {siteKindsText({ kinds: record.kinds })}
        </span>
      </div>
      {record.tie === null ? null : <Chip tone="info" label={TIE_LABEL[record.tie]} />}
      <Button
        variant="ghost"
        size="sm"
        intent={actionIntentOf({ verb: CLEAR_VERB })}
        aria-label={`Clear ${site}`}
        onClick={() => setIsAsking(true)}
      >
        Clear
      </Button>
    </div>
  );
};
