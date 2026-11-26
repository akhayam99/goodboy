import { requestUrlOf } from '../../requestUrlOf';
import type { BrowserConsoleEntry } from '../../types';
import { NetworkFactList } from './NetworkFactList';
import { requestFactsOf } from './requestFactsOf';

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly pageUrl: string;
};

const HIDDEN_NOTE = 'Authorization and cookie headers are never read, so no agent gets them.';

export const NetworkHeaders = ({ entry, pageUrl }: Props) => {
  const facts = entry.network;
  const general = [
    { label: 'Request URL', value: requestUrlOf({ entry, pageUrl }) },
    { label: 'Method', value: entry.method ?? 'GET' },
    { label: 'Status', value: requestFactsOf({ entry }).status },
  ];
  const sections = [
    { label: 'Response headers', headers: facts?.responseHeaders ?? [] },
    { label: 'Request headers', headers: facts?.requestHeaders ?? [] },
  ].filter((section) => section.headers.length > 0);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <NetworkFactList label="General" facts={general} />
      {sections.map((section) => (
        <section key={section.label} className="flex min-w-0 flex-col gap-1">
          <h4 className="text-eyebrow text-faint-foreground">{section.label}</h4>
          <NetworkFactList
            label={section.label}
            facts={section.headers.map((header) => ({ label: header.name, value: header.value }))}
          />
        </section>
      ))}
      <p className="text-meta text-faint-foreground">{HIDDEN_NOTE}</p>
    </div>
  );
};
