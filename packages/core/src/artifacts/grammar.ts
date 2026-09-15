export const ARTIFACT_SCHEMA_VERSION = 1;

export const ARTIFACT_MAX_BYTES = 512 * 1024;

const OPEN_RE = /^[ \t]*<<artifact((?:\s+[a-zA-Z-]+=(?:"[^"]*"|[^\s>]+))*)\s*>>[ \t]*$/;
const CLOSE_RE = /^[ \t]*<<\/artifact>>[ \t]*$/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;
const ATTR_RE = /([a-zA-Z-]+)=(?:"([^"]*)"|([^\s>]+))/g;

export type ArtifactBlock = {
  readonly attrs: Readonly<Record<string, string>>;
  readonly body: string;
  readonly complete: boolean;
};

const parseAttrs = (raw: string): Readonly<Record<string, string>> => {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs[match[1]!.toLowerCase()] = match[2] ?? match[3] ?? '';
  }
  return attrs;
};

const fenceRun = (line: string): string | null => {
  const match = FENCE_RE.exec(line);
  return match === null ? null : match[1]!;
};

const closesFence = ({ line, open }: { readonly line: string; readonly open: string }): boolean => {
  const run = fenceRun(line);
  return run !== null && run[0] === open[0] && run.length >= open.length;
};

export const extractArtifactBlocks = (text: string): ReadonlyArray<ArtifactBlock> => {
  const lines = text.split('\n');
  const out: ArtifactBlock[] = [];
  let fence: string | null = null;
  let open: { readonly attrs: Readonly<Record<string, string>>; readonly body: string[] } | null =
    null;

  for (const line of lines) {
    if (fence !== null) {
      if (closesFence({ line, open: fence })) {
        fence = null;
      }
      if (open !== null) {
        open.body.push(line);
      }
      continue;
    }
    if (open === null) {
      const fenceStart = fenceRun(line);
      if (fenceStart !== null) {
        fence = fenceStart;
        continue;
      }
      const match = OPEN_RE.exec(line);
      if (match !== null) {
        open = { attrs: parseAttrs(match[1] ?? ''), body: [] };
      }
      continue;
    }
    if (CLOSE_RE.test(line)) {
      out.push({ attrs: open.attrs, body: open.body.join('\n'), complete: true });
      open = null;
      continue;
    }
    const fenceStart = fenceRun(line);
    if (fenceStart !== null) {
      fence = fenceStart;
    }
    open.body.push(line);
  }

  if (open !== null) {
    out.push({ attrs: open.attrs, body: open.body.join('\n'), complete: false });
  }
  return out;
};
