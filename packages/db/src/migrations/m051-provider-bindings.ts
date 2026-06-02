export const m051ProviderBindings = /* sql */ `
ALTER TABLE workspaces ADD COLUMN provider_bindings TEXT;
ALTER TABLE sessions ADD COLUMN provider_bindings TEXT;
`;
