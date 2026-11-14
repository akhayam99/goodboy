import type { RunnableScript } from '../scripts/buildSessionScripts';

type Params = {
  readonly script: Pick<RunnableScript, 'invocation' | 'relDir'>;
};

export const scriptCommandOf = ({ script }: Params): string => {
  if (script.relDir === '') {
    return `${script.invocation}\r`;
  }
  const dir = script.relDir.replace(/'/g, "'\\''");
  return `cd '${dir}' && ${script.invocation}\r`;
};
