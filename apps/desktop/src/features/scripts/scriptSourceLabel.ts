import type { RunnableScriptSource } from './buildSessionScripts';

export const SCRIPT_SOURCE_LABEL: Readonly<Record<RunnableScriptSource, string>> = {
  saved: 'Saved',
  'package-json': 'package.json',
  composer: 'composer.json',
};
