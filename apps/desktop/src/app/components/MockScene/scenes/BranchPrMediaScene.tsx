import { useEffect, useRef } from 'react';
import {
  Markdown,
  RemoteImageLoaderProvider,
  type RemoteMediaKind,
  type RemoteVideoFile,
} from '@goodboy/ui';

const ATTACHMENT_HOST = 'https://github.com/user-attachments/assets/';

const BOARD_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='640' height='360' fill='%23e8eef7'/><rect x='24' y='24' width='592' height='48' rx='8' fill='%23c5d3ea'/><rect x='24' y='96' width='280' height='240' rx='8' fill='%23d6e0f0'/><rect x='336' y='96' width='280' height='240' rx='8' fill='%23d6e0f0'/></svg>";

const DESCRIPTION = [
  'Harborline export now streams from ledger-core instead of buffering.',
  `<img src="${ATTACHMENT_HOST}ledger-before" alt="Before, buffered export" width="480">`,
  `<video src="${ATTACHMENT_HOST}ledger-demo" controls="controls"></video>`,
  `<video src="${ATTACHMENT_HOST}ledger-full-run" controls="controls"></video>`,
  `${ATTACHMENT_HOST}ledger-after`,
  '<details>\n<summary>Logs from notify-relay</summary>\n\nretry **twice** with `backoff`\n</details>',
].join('\n\n');

const COMMENT = [
  'Northwind sees the same row on payments-api.',
  `![Acme dashboard after the change](${ATTACHMENT_HOST}ledger-comment.png)`,
].join('\n\n');

type ProbeParams = {
  readonly url: string;
};

const probe = async ({ url }: ProbeParams): Promise<RemoteMediaKind> =>
  url.endsWith('ledger-after') ? 'image' : 'video';

const load = async (): Promise<string> => BOARD_IMAGE;

const SAMPLE_BYTES = 4_400_000;
const REFUSED = 'that video is larger than 50 MB, so nothing was loaded';

const loadVideo = async ({ url }: ProbeParams): Promise<RemoteVideoFile> => {
  if (url.endsWith('ledger-full-run')) {
    throw new Error(REFUSED);
  }
  return { blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }), bytes: SAMPLE_BYTES };
};

type AutoLoadParams = {
  readonly url: string;
};

const isAttachment = ({ url }: AutoLoadParams): boolean => url.startsWith(ATTACHMENT_HOST);

const onOpen = (): void => undefined;

export const BranchPrMediaScene = () => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const play = bodyRef.current?.querySelector<HTMLButtonElement>(
        '[data-block="video-poster"] button',
      );
      if (play === null || play === undefined || play.textContent !== 'Play') {
        return;
      }
      clearInterval(timer);
      play.click();
    }, 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <RemoteImageLoaderProvider
      load={load}
      shouldAutoLoad={(url) => isAttachment({ url })}
      probe={probe}
      loadVideo={loadVideo}
      onOpen={onOpen}
    >
      <div ref={bodyRef} className="flex max-w-[var(--measure)] flex-col gap-6 p-6">
        <section aria-label="Description" className="flex flex-col gap-3">
          <Markdown text={DESCRIPTION} className="text-prose" />
        </section>
        <section aria-label="Comment" className="flex flex-col gap-2">
          <Markdown text={COMMENT} variant="preview" className="text-body text-foreground" />
        </section>
      </div>
    </RemoteImageLoaderProvider>
  );
};
