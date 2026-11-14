export type DependencyGrant = Readonly<{
  name: string;
  version: string | null;
}>;

const VERSION_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.+-_';
const PIN_PREFIXES = ['===', '==', '=', '^', '~', 'v'] as const;

type TextParams = {
  readonly text: string;
};

export const pinnedVersionOf = ({ text }: TextParams): string | null => {
  const prefix = PIN_PREFIXES.find((candidate) => text.startsWith(candidate)) ?? '';
  const rest = text.slice(prefix.length);
  const version = rest.startsWith('v') ? rest.slice(1) : rest;
  if (version === '' || ![...version].every((char) => VERSION_CHARS.includes(char))) {
    return null;
  }
  return version;
};

type SubjectsParams = {
  readonly allowedPackages: ReadonlyArray<string>;
};

export const dependencyGrantsOf = ({
  allowedPackages,
}: SubjectsParams): ReadonlyArray<DependencyGrant> =>
  allowedPackages.map((subject) => {
    const at = subject.lastIndexOf('@');
    if (at <= 0) {
      return { name: subject.toLowerCase(), version: null };
    }
    return {
      name: subject.slice(0, at).toLowerCase(),
      version: pinnedVersionOf({ text: subject.slice(at + 1) }) ?? subject.slice(at + 1),
    };
  });

type GrantedParams = {
  readonly grants: ReadonlyArray<DependencyGrant>;
  readonly name: string;
  readonly spec: string | null;
};

export const isSpecGranted = ({ grants, name, spec }: GrantedParams): boolean => {
  const grant = grants.find((candidate) => candidate.name === name.toLowerCase());
  if (grant === undefined) {
    return false;
  }
  const version = spec === null ? null : pinnedVersionOf({ text: spec });
  if (grant.version === null) {
    return spec === null || version !== null;
  }
  return version === grant.version;
};

type NameParams = {
  readonly grants: ReadonlyArray<DependencyGrant>;
  readonly name: string;
};

export const isNameGranted = ({ grants, name }: NameParams): boolean =>
  grants.some((grant) => grant.name === name.toLowerCase());
