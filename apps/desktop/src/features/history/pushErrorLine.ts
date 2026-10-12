type Params = {
  readonly message: string;
};

const LINE_LIMIT = 160;
const SCAN_LIMIT = 20000;
const REMOTE_PREFIX = 'remote:';
const NOISE_PREFIXES = ['hint:', 'to ', 'everything up-to-date', 'error: failed to push some refs'];
const CAUSE_WORDS = [
  'rejected',
  'denied',
  'declined',
  'protected',
  'permission',
  'authenticat',
  'unable',
  'could not',
  'cannot',
  'fatal',
  'hook',
  'timed out',
  'unreachable',
];

type CleanParams = {
  readonly raw: string;
};

const cleanLine = ({ raw }: CleanParams): string => {
  let line = raw.trim();
  while (line.toLowerCase().startsWith(REMOTE_PREFIX)) {
    line = line.slice(REMOTE_PREFIX.length).trim();
  }
  return line.startsWith('! ') ? line.slice(2).trim() : line;
};

type LineParams = {
  readonly line: string;
};

const isNoise = ({ line }: LineParams): boolean => {
  const lower = line.toLowerCase();
  return line === '' || NOISE_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const hasCause = ({ line }: LineParams): boolean => {
  const lower = line.toLowerCase();
  return CAUSE_WORDS.some((word) => lower.includes(word));
};

export const pushErrorLine = ({ message }: Params): string => {
  const lines = message
    .slice(0, SCAN_LIMIT)
    .split('\n')
    .map((raw) => cleanLine({ raw }))
    .filter((line) => !isNoise({ line }));
  const picked = lines.find((line) => hasCause({ line })) ?? lines[0] ?? '';
  return picked.length > LINE_LIMIT ? `${picked.slice(0, LINE_LIMIT)}...` : picked;
};
