const CONFINED_WRITER_ROLES: ReadonlySet<string> = new Set(['implementer', 'tester', 'docs']);

type Params = Readonly<{
  role: string | undefined;
}>;

export const isConfinedWriterRole = ({ role }: Params): boolean =>
  role !== undefined && CONFINED_WRITER_ROLES.has(role);
