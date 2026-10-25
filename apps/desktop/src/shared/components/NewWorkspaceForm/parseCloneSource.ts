import type { CloneHostKey } from '../../lib/repoClone/repoCloneTypes';
import { CLONE_HOSTS, type CloneHostOption } from './cloneHosts';

export type CloneSourceReading =
  | { readonly kind: 'empty' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'needs-host'; readonly name: string }
  | {
      readonly kind: 'ready';
      readonly host: CloneHostKey;
      readonly name: string;
      readonly remote: string;
      readonly form: 'url' | 'owner-name';
    };

type ParseParams = {
  readonly text: string;
  readonly host: CloneHostKey | null;
};

type SplitRemote = {
  readonly domain: string;
  readonly path: string;
  readonly isSsh: boolean;
};

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

const UNKNOWN: CloneSourceReading = { kind: 'unknown' };

type DomainParams = {
  readonly domain: string;
};

type TextParams = {
  readonly text: string;
};

const hostOfDomain = ({ domain }: DomainParams): CloneHostOption | undefined =>
  CLONE_HOSTS.find((option) => option.domain === domain.toLowerCase().replace(/^www\./, ''));

const splitRemote = ({ text }: TextParams): SplitRemote | null => {
  const prefixes = [
    { prefix: 'https://', isSsh: false },
    { prefix: 'ssh://git@', isSsh: true },
  ];
  for (const { prefix, isSsh } of prefixes) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length);
      const cut = rest.indexOf('/');
      return cut < 0 ? null : { domain: rest.slice(0, cut), path: rest.slice(cut + 1), isSsh };
    }
  }
  if (text.startsWith('git@')) {
    const rest = text.slice('git@'.length);
    const cut = rest.indexOf(':');
    return cut < 0 ? null : { domain: rest.slice(0, cut), path: rest.slice(cut + 1), isSsh: true };
  }
  return null;
};

type SegmentsParams = {
  readonly path: string;
};

const trimSlashes = ({ path }: SegmentsParams): string => {
  let start = 0;
  let end = path.length;
  while (start < end && path[start] === '/') {
    start += 1;
  }
  while (end > start && path[end - 1] === '/') {
    end -= 1;
  }
  return path.slice(start, end);
};

const repositorySegmentsOf = ({ path }: SegmentsParams): ReadonlyArray<string> | null => {
  const trimmed = trimSlashes({ path });
  const bare = trimmed.endsWith('.git') ? trimmed.slice(0, -'.git'.length) : trimmed;
  const segments = bare.split('/');
  return segments.length >= 2 && segments.every((segment) => SEGMENT.test(segment))
    ? segments
    : null;
};

type RemoteParams = {
  readonly host: CloneHostOption;
  readonly segments: ReadonlyArray<string>;
};

const canonicalRemote = ({ host, segments }: RemoteParams): string =>
  `https://${host.domain}/${segments.join('/')}.git`;

const isSegmentCountValid = ({ host, segments }: RemoteParams): boolean =>
  host.key === 'gitlab' ? segments.length >= 2 : segments.length === 2;

export const parseCloneSource = ({ text, host }: ParseParams): CloneSourceReading => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { kind: 'empty' };
  }
  if (/[\s?#]/.test(trimmed)) {
    return UNKNOWN;
  }
  const split = splitRemote({ text: trimmed });
  if (split !== null) {
    const option = hostOfDomain({ domain: split.domain });
    const segments = repositorySegmentsOf({ path: split.path });
    const name = segments?.at(-1);
    if (
      option === undefined ||
      segments === null ||
      name === undefined ||
      !isSegmentCountValid({ host: option, segments })
    ) {
      return UNKNOWN;
    }
    return {
      kind: 'ready',
      host: option.key,
      name,
      remote: split.isSsh ? trimmed : canonicalRemote({ host: option, segments }),
      form: 'url',
    };
  }
  const segments = repositorySegmentsOf({ path: trimmed });
  const name = segments?.at(-1);
  if (segments === null || name === undefined) {
    return UNKNOWN;
  }
  const chosen = CLONE_HOSTS.find((option) => option.key === host);
  if (chosen === undefined) {
    return segments.length === 2 ? { kind: 'needs-host', name } : UNKNOWN;
  }
  return isSegmentCountValid({ host: chosen, segments })
    ? {
        kind: 'ready',
        host: chosen.key,
        name,
        remote: canonicalRemote({ host: chosen, segments }),
        form: 'owner-name',
      }
    : UNKNOWN;
};
