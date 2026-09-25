type Params = {
  readonly name: string;
  readonly sourceWorkspaceName: string;
  readonly taken: ReadonlySet<string>;
};

export const importedWorkflowName = ({ name, sourceWorkspaceName, taken }: Params): string => {
  if (!taken.has(name)) {
    return name;
  }
  const scoped = `${name} (${sourceWorkspaceName})`;
  if (!taken.has(scoped)) {
    return scoped;
  }
  let suffix = 2;
  while (taken.has(`${scoped} ${suffix}`)) {
    suffix += 1;
  }
  return `${scoped} ${suffix}`;
};
