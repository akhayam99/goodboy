import { redactSecrets } from './redactSecrets';

export const REDACTED_EMAIL = '[email]';

export const REDACTED_URL = '[url]';

export const REDACTED_ID = '[id]';

export const REDACTED_IP = '[ip]';

export const REDACTED_USER = '[user]';

const ELIDED = '…';

const URL_PATTERN = /\b([a-z][a-z0-9+.-]*):\/\/([^\s"'`<>()[\]{}]+)/gi;

const SCP_REMOTE_PATTERN = /\b[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}:[^\s"'`]+/g;

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const IPV4_PATTERN =
  /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\w.])/g;

const HOME_PATH_PATTERN =
  /(?:\/Users|\/home|[A-Za-z]:\\Users|[A-Za-z]:\/Users)[\\/]([^\\/\s"'`)]+)((?:[\\/][^\\/\s"'`)]+)*)[\\/]?/g;

const TILDE_PATH_PATTERN = /(?<![\w~])~((?:[\\/][^\\/\s"'`)]+)+)/g;

const PERSONAL_ROOT_PATTERN =
  /(\/(?:Volumes|mnt|media|tmp|private\/tmp|private\/var\/folders|var\/folders))((?:\/[^/\s"'`)]+)+)/g;

const APP_HOSTS: ReadonlySet<string> = new Set(['tauri.localhost', 'asset.localhost']);

const APP_SCHEMES: ReadonlySet<string> = new Set(['tauri', 'asset']);

const PRIVATE_HOST_PATTERNS: ReadonlyArray<RegExp> = [
  /^localhost$/,
  /\.localhost$/,
  /\.local$/,
  /\.internal$/,
  /\.lan$/,
  /\.corp$/,
  /\.home$/,
  /^\d{1,3}(?:\.\d{1,3}){3}$/,
  /^\[/,
  /^[^.]+$/,
];

const FILE_NAME_PATTERN = /^(?:\.[A-Za-z0-9_-]+|[^.\\/]+(?:\.[A-Za-z0-9]{1,8})+)(?::\d+){0,2}:?$/;

const MIN_NAME_LENGTH = 3;

type HostParams = {
  readonly host: string;
};

const isPrivateHost = ({ host }: HostParams): boolean =>
  PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host));

type SplitUrlParams = {
  readonly rest: string;
};

type SplitUrl = {
  readonly host: string;
  readonly path: string;
};

const splitUrl = ({ rest }: SplitUrlParams): SplitUrl => {
  const withoutFragment = rest.split('#')[0] ?? '';
  const withoutQuery = withoutFragment.split('?')[0] ?? '';
  const slash = withoutQuery.indexOf('/');
  const authority = slash === -1 ? withoutQuery : withoutQuery.slice(0, slash);
  const path = slash === -1 ? '' : withoutQuery.slice(slash);
  const hostAndPort = authority.includes('@') ? (authority.split('@').pop() ?? '') : authority;
  const host = (hostAndPort.split(':')[0] ?? '').toLowerCase();
  return { host, path };
};

type RedactUrlParams = {
  readonly scheme: string;
  readonly rest: string;
};

const redactUrl = ({ scheme, rest }: RedactUrlParams): string => {
  const lowerScheme = scheme.toLowerCase();
  const { host, path } = splitUrl({ rest });
  if (APP_SCHEMES.has(lowerScheme) || APP_HOSTS.has(host)) {
    return `${lowerScheme}://${host}${path}`;
  }
  if (lowerScheme === 'file') {
    return REDACTED_URL;
  }
  if (host === '' || isPrivateHost({ host })) {
    return REDACTED_URL;
  }
  const trimmedPath = path === '' || path === '/' ? '' : `/${ELIDED}`;
  return `${lowerScheme}://${host}${trimmedPath}`;
};

type TailParams = {
  readonly tail: string;
};

const keptTail = ({ tail }: TailParams): string => {
  const segments = tail.split(/[\\/]/).filter((segment) => segment !== '');
  const last = segments.at(-1);
  if (last === undefined) {
    return '';
  }
  const fileName = FILE_NAME_PATTERN.test(last) ? last : null;
  if (fileName === null) {
    return `/${ELIDED}`;
  }
  return segments.length === 1 ? `/${fileName}` : `/${ELIDED}/${fileName}`;
};

type CollectUsersParams = {
  readonly text: string;
};

const collectHomeUsers = ({ text }: CollectUsersParams): ReadonlyArray<string> =>
  [...text.matchAll(HOME_PATH_PATTERN)]
    .map((match) => match[1] ?? '')
    .filter((user) => user.length >= MIN_NAME_LENGTH);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type ReplaceWordParams = {
  readonly text: string;
  readonly word: string;
  readonly replacement: string;
};

const replaceWord = ({ text, word, replacement }: ReplaceWordParams): string =>
  text.replace(
    new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(word)}(?![A-Za-z0-9_])`, 'gi'),
    replacement,
  );

type RedactNamesParams = {
  readonly text: string;
  readonly names: ReadonlyArray<string>;
};

const redactNames = ({ text, names }: RedactNamesParams): string => {
  const unique = [...new Set(names.map((name) => name.trim()))].filter(
    (name) => name.length >= MIN_NAME_LENGTH,
  );
  const numbered = unique.map((name, index) => ({ name, placeholder: `[name-${index + 1}]` }));
  return [...numbered]
    .sort((left, right) => right.name.length - left.name.length)
    .reduce(
      (carried, { name, placeholder }) =>
        replaceWord({ text: carried, word: name, replacement: placeholder }),
      text,
    );
};

type RedactPathsParams = {
  readonly text: string;
};

const redactPaths = ({ text }: RedactPathsParams): string =>
  text
    .replace(HOME_PATH_PATTERN, (_match, _user: string, tail: string) => `~${keptTail({ tail })}`)
    .replace(TILDE_PATH_PATTERN, (_match, tail: string) => `~${keptTail({ tail })}`)
    .replace(
      PERSONAL_ROOT_PATTERN,
      (_match, root: string, tail: string) => `${root}${keptTail({ tail })}`,
    );

type RedactReportParams = {
  readonly text: string;
  readonly names?: ReadonlyArray<string>;
};

export const redactReport = ({ text, names = [] }: RedactReportParams): string => {
  const users = collectHomeUsers({ text });
  const withoutUrls = text.replace(URL_PATTERN, (_match, scheme: string, rest: string) =>
    redactUrl({ scheme, rest }),
  );
  const withoutSecrets = redactSecrets({ text: withoutUrls });
  const withoutEmails = withoutSecrets
    .replace(SCP_REMOTE_PATTERN, REDACTED_URL)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);
  const withoutPaths = redactPaths({ text: withoutEmails });
  const withoutIds = withoutPaths.replace(UUID_PATTERN, REDACTED_ID);
  const withoutIps = withoutIds.replace(IPV4_PATTERN, REDACTED_IP);
  const withoutNames = redactNames({ text: withoutIps, names });
  return users.reduce(
    (carried, user) => replaceWord({ text: carried, word: user, replacement: REDACTED_USER }),
    withoutNames,
  );
};
