import type { IsoDateTime, MessageAttachment } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-14T10:20:00.000Z' });

const ATTACHMENTS_WORKING_DIR = '/mock/harborline/payments-api';

const ATTACHMENTS_AT: IsoDateTime = clock.iso({ at: '2026-10-14T10:18:00.000Z' });

const ATTACHMENTS_TEXT =
  'Checkout fails after the second retry on payments-api. These are the screens and the log from the Northwind test account.';

type ShotSpec = {
  readonly fileName: string;
  readonly hue: number;
  readonly caption: string;
};

const SHOTS: ReadonlyArray<ShotSpec> = [
  { fileName: 'checkout-502.png', hue: 8, caption: 'Checkout 502' },
  { fileName: 'ledger-diff.png', hue: 210, caption: 'Ledger diff' },
  { fileName: 'retry-trace.png', hue: 150, caption: 'Retry trace' },
  { fileName: 'notify-relay-log.png', hue: 38, caption: 'notify-relay log' },
  { fileName: 'webhook-timeout.png', hue: 275, caption: 'Webhook timeout' },
];

type IndexParams = {
  readonly index: number;
};

const idOf = ({ index }: IndexParams): string => `mock-attachment-${index + 1}`;

const ATTACHMENTS_MESSAGE: ReadonlyArray<MessageAttachment> = [
  ...SHOTS.map(({ fileName }, index): MessageAttachment => ({
    id: idOf({ index }),
    kind: 'image',
    fileName,
    mimeType: 'image/png',
    relPath: `.goodboy/attachments/${idOf({ index })}-${fileName}`,
  })),
  {
    id: 'mock-attachment-notes',
    kind: 'file',
    fileName: 'ledger-notes.txt',
    mimeType: 'text/plain',
    relPath: '.goodboy/attachments/mock-attachment-notes-ledger-notes.txt',
  },
];

const svgOf = ({ hue, caption }: ShotSpec): string =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">',
    `<rect width="480" height="300" fill="hsl(${hue} 32% 94%)"/>`,
    `<rect x="24" y="24" width="432" height="36" rx="8" fill="hsl(${hue} 45% 68%)"/>`,
    `<rect x="24" y="84" width="300" height="14" rx="6" fill="hsl(${hue} 30% 78%)"/>`,
    `<rect x="24" y="112" width="380" height="14" rx="6" fill="hsl(${hue} 30% 82%)"/>`,
    `<rect x="24" y="140" width="220" height="14" rx="6" fill="hsl(${hue} 30% 78%)"/>`,
    `<rect x="24" y="190" width="140" height="48" rx="10" fill="hsl(${hue} 50% 52%)"/>`,
    `<text x="24" y="276" font-family="sans-serif" font-size="18" fill="hsl(${hue} 40% 30%)">${caption}</text>`,
    '</svg>',
  ].join('');

type RelPathParams = {
  readonly relPath: string;
};

const attachmentDataUriOf = ({ relPath }: RelPathParams): string | null => {
  const shot = SHOTS.find(({ fileName }) => relPath.endsWith(fileName));
  if (shot === undefined) {
    return null;
  }
  return `data:image/svg+xml,${encodeURIComponent(svgOf(shot))}`;
};

type PayloadParams = {
  readonly payload: unknown;
};

const relPathOfPayload = ({ payload }: PayloadParams): string | null => {
  if (typeof payload !== 'object' || payload === null || !('relPath' in payload)) {
    return null;
  }
  return typeof payload.relPath === 'string' ? payload.relPath : null;
};

export const ATTACHMENTS_SEED = {
  workingDir: ATTACHMENTS_WORKING_DIR,
  at: ATTACHMENTS_AT,
  text: ATTACHMENTS_TEXT,
  message: ATTACHMENTS_MESSAGE,
  dataUriOf: attachmentDataUriOf,
  relPathOfPayload,
};
