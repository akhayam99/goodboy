export type PermissionsState = {
  readonly volatilePermissionAllows: ReadonlySet<string>;
};

export const permissionsInitialState: PermissionsState = {
  volatilePermissionAllows: new Set<string>(),
};
