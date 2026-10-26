const SERVE_HANDOFF_COMMAND =
  /\bserveHandoff\s*(?:<[^()]*?>)?\s*\(\s*\{[\s\S]*?\bcommand:\s*(['"`])([^'"`]+)\1/g;

export const serveHandoffCommandNames = ({ source }) => {
  const names = new Set();
  for (const match of source.matchAll(SERVE_HANDOFF_COMMAND)) {
    names.add(match[2]);
  }
  return names;
};
