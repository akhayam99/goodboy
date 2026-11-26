import { EmptyLine } from '@goodboy/ui';
import type { BrowserConsoleEntry } from '../../types';
import { NetworkFactList } from './NetworkFactList';
import { networkBodyTextOf } from './networkBodyTextOf';

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly part: 'request' | 'response';
};

const EMPTY_TEXT = {
  request: 'No body sent',
  response: 'No text body read. Only text and JSON bodies up to 64 kB are kept.',
} as const;

export const NetworkBody = ({ entry, part }: Props) => {
  const facts = entry.network;
  const socket = facts?.socket ?? null;
  if (socket !== null) {
    return (
      <NetworkFactList
        label={part === 'request' ? 'Frames sent' : 'Frames received'}
        facts={[
          part === 'request'
            ? { label: 'Frames sent', value: String(socket.sent) }
            : { label: 'Frames received', value: String(socket.received) },
          ...(part === 'response' && socket.code !== null
            ? [{ label: 'Close code', value: String(socket.code) }]
            : []),
        ]}
      />
    );
  }
  const body = (part === 'request' ? facts?.requestBody : facts?.responseBody) ?? null;
  if (body === null || body.trim() === '') {
    return <EmptyLine>{EMPTY_TEXT[part]}</EmptyLine>;
  }
  return (
    <pre
      aria-label={part === 'request' ? 'Request body' : 'Response body'}
      className="whitespace-pre-wrap break-words text-code text-foreground"
    >
      {networkBodyTextOf({ body })}
    </pre>
  );
};
