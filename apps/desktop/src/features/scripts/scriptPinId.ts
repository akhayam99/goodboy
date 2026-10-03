import type { RunnableScriptSource } from './buildSessionScripts';

type Params = {
  readonly source: RunnableScriptSource;
  readonly relDir: string;
  readonly name: string;
  readonly savedId: string | null;
};

export const scriptPinId = ({ source, relDir, name, savedId }: Params): string =>
  JSON.stringify(savedId === null ? [source, relDir, name] : ['saved', '', savedId]);
