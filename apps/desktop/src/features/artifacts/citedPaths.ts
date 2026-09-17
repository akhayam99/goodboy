export const CITED_PATH_LIMITS = {
  paths: 40,
  directories: 20,
  budgetMs: 8_000,
} as const;

const PATH_CHARS = /^[A-Za-z0-9._@/+-]+$/;

const TRIM_CHARS = new Set(['`', '"', "'", '(', ')', '[', ']', '{', '}', ',', '.', ';', ':', '*']);

type TextParams = Readonly<{
  text: string;
}>;

const trimDecoration = ({ token }: Readonly<{ token: string }>): string => {
  let start = 0;
  let end = token.length;
  while (start < end && TRIM_CHARS.has(token[start]!)) {
    start += 1;
  }
  while (end > start && TRIM_CHARS.has(token[end - 1]!)) {
    end -= 1;
  }
  return token.slice(start, end);
};

const isRepoPath = ({ token }: Readonly<{ token: string }>): boolean => {
  if (token.length === 0 || token.length > 200) {
    return false;
  }
  if (!token.includes('/') || token.startsWith('/') || token.startsWith('.')) {
    return false;
  }
  if (token.includes('://') || token.includes('..')) {
    return false;
  }
  return PATH_CHARS.test(token);
};

export const extractCitedPaths = ({ text }: TextParams): ReadonlyArray<string> => {
  const found: Array<string> = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last === undefined) {
      continue;
    }
    const candidate = trimDecoration({ token: last });
    if (!isRepoPath({ token: candidate }) || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    found.push(candidate);
    if (found.length === CITED_PATH_LIMITS.paths) {
      return found;
    }
  }
  return found;
};

export type CitedPathVerification = Readonly<{
  cited: number;
  verified: ReadonlyArray<string>;
  missing: ReadonlyArray<string>;
  unverified: ReadonlyArray<string>;
}>;

export const EMPTY_CITED_PATH_VERIFICATION: CitedPathVerification = {
  cited: 0,
  verified: [],
  missing: [],
  unverified: [],
};

export type CitedPathListing = ReadonlyArray<Readonly<{ name: string }>>;

type VerifyParams = Readonly<{
  paths: ReadonlyArray<string>;
  list: (params: Readonly<{ relPath: string }>) => Promise<CitedPathListing>;
  knownPaths?: ReadonlyArray<string>;
  now?: () => number;
}>;

const parentOf = ({ path }: Readonly<{ path: string }>): string => {
  const cut = path.lastIndexOf('/');
  return cut <= 0 ? '' : path.slice(0, cut);
};

const basenameOf = ({ path }: Readonly<{ path: string }>): string => {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? path : path.slice(cut + 1);
};

export const verifyCitedPaths = async ({
  paths,
  list,
  knownPaths = [],
  now = Date.now,
}: VerifyParams): Promise<CitedPathVerification> => {
  const capped = paths.slice(0, CITED_PATH_LIMITS.paths);
  if (capped.length === 0) {
    return EMPTY_CITED_PATH_VERIFICATION;
  }
  const known = new Set(knownPaths);
  const verified: Array<string> = [];
  const byDirectory = new Map<string, Array<string>>();
  for (const path of capped) {
    if (known.has(path)) {
      verified.push(path);
      continue;
    }
    const parent = parentOf({ path });
    const bucket = byDirectory.get(parent);
    if (bucket === undefined) {
      byDirectory.set(parent, [path]);
      continue;
    }
    bucket.push(path);
  }
  const startedAt = now();
  const missing: Array<string> = [];
  const unverified: Array<string> = [];
  let listed = 0;
  for (const [directory, members] of byDirectory) {
    if (
      listed >= CITED_PATH_LIMITS.directories ||
      now() - startedAt >= CITED_PATH_LIMITS.budgetMs
    ) {
      unverified.push(...members);
      continue;
    }
    listed += 1;
    let names: ReadonlySet<string> | null = null;
    try {
      const entries = await list({ relPath: directory });
      names = new Set(entries.map((entry) => entry.name));
    } catch {
      names = null;
    }
    if (names === null) {
      unverified.push(...members);
      continue;
    }
    for (const member of members) {
      if (names.has(basenameOf({ path: member }))) {
        verified.push(member);
        continue;
      }
      missing.push(member);
    }
  }
  return { cited: capped.length, verified, missing, unverified };
};

const MISSING_IN_HEADER = 3;

type HeaderParams = Readonly<{
  verification: CitedPathVerification;
}>;

export const citedPathHeader = ({ verification }: HeaderParams): string => {
  const counted = `verified ${verification.verified.length} of ${verification.cited} cited paths`;
  if (verification.missing.length === 0) {
    return counted;
  }
  const head = verification.missing.slice(0, MISSING_IN_HEADER).join(', ');
  const rest = verification.missing.length - MISSING_IN_HEADER;
  return rest > 0
    ? `${counted}; missing: ${head} and ${rest} more`
    : `${counted}; missing: ${head}`;
};

export const isCitedPathMajorityVerified = ({ verification }: HeaderParams): boolean => {
  if (verification.cited === 0) {
    return true;
  }
  return verification.verified.length * 2 >= verification.cited;
};
