type Params = {
  readonly grants: ReadonlyArray<unknown>;
};

type GrantParams = {
  readonly grant: string;
};

const READ_GRANT_OPEN = 'Read(';

const isScopedReadGrant = ({ grant }: GrantParams): boolean =>
  grant.startsWith(READ_GRANT_OPEN) &&
  grant.endsWith(')') &&
  grant.length > READ_GRANT_OPEN.length + 1;

export const scopedReadGrantsOf = ({ grants }: Params): ReadonlyArray<string> =>
  grants.flatMap((grant) =>
    typeof grant === 'string' && isScopedReadGrant({ grant }) ? [grant] : [],
  );
