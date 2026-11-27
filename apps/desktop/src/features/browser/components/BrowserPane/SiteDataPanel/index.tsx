import { useEffect, useRef } from 'react';
import { EmptyLine } from '@goodboy/ui';
import type { BrowserSiteRecords } from '../../../types';
import { SiteDataRow } from './SiteDataRow';

type Props = {
  readonly siteRecords: BrowserSiteRecords;
  readonly readKey: string | null;
};

const SETTINGS_LINE = 'To clear every site, use Clear browser data in the workspace settings.';

export const SiteDataPanel = ({ siteRecords, readKey }: Props) => {
  const read = useRef(siteRecords.read);
  read.current = siteRecords.read;

  useEffect(() => {
    read.current();
  }, [readKey]);

  const records = siteRecords.records;
  const count = records?.length ?? 0;
  const summary =
    records === null
      ? 'Reading the sites of this workspace.'
      : `${count} ${count === 1 ? 'site keeps' : 'sites keep'} data in this workspace.`;

  return (
    <div data-site-data-panel="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-col gap-1 px-3 pt-3">
        <h2 className="text-row text-foreground">Site data</h2>
        <p role="status" className="text-meta text-muted-foreground">
          {summary}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-2">
        {records !== null && records.length === 0 ? (
          <EmptyLine className="px-2">No site keeps data in this workspace.</EmptyLine>
        ) : null}
        {(records ?? []).map((record) => (
          <SiteDataRow key={record.name} record={record} onClear={siteRecords.clear} />
        ))}
        <p className="px-2 py-2 text-meta text-faint-foreground">{SETTINGS_LINE}</p>
      </div>
    </div>
  );
};
