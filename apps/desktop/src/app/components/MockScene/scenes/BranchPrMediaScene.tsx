import { Markdown, RemoteImageLoaderProvider, type RemoteMediaKind } from '@goodboy/ui';

const ATTACHMENT_HOST = 'https://github.com/user-attachments/assets/';

const BOARD_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='640' height='360' fill='%23e8eef7'/><rect x='24' y='24' width='592' height='48' rx='8' fill='%23c5d3ea'/><rect x='24' y='96' width='280' height='240' rx='8' fill='%23d6e0f0'/><rect x='336' y='96' width='280' height='240' rx='8' fill='%23d6e0f0'/></svg>";

const DESCRIPTION = [
  'Harborline export now streams from ledger-core instead of buffering.',
  `<img src="${ATTACHMENT_HOST}ledger-before" alt="Before, buffered export" width="480">`,
  `<video src="${ATTACHMENT_HOST}ledger-demo" controls="controls"></video>`,
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

type AutoLoadParams = {
  readonly url: string;
};

const isAttachment = ({ url }: AutoLoadParams): boolean => url.startsWith(ATTACHMENT_HOST);

const onOpen = (): void => undefined;

export const BranchPrMediaScene = () => (
  <RemoteImageLoaderProvider
    load={load}
    shouldAutoLoad={(url) => isAttachment({ url })}
    probe={probe}
    onOpen={onOpen}
  >
    <div className="flex max-w-[var(--measure)] flex-col gap-6 p-6">
      <section aria-label="Description" className="flex flex-col gap-3">
        <Markdown text={DESCRIPTION} className="text-prose" />
      </section>
      <section aria-label="Comment" className="flex flex-col gap-2">
        <Markdown text={COMMENT} variant="preview" className="text-body text-foreground" />
      </section>
    </div>
  </RemoteImageLoaderProvider>
);
