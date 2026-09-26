import type { RunnableScript, RunnableScriptSource } from './buildSessionScripts';

export type ScriptPackageSection = {
  readonly key: string;
  readonly source: RunnableScriptSource;
  readonly packageName: string;
  readonly relDir: string;
  readonly scripts: ReadonlyArray<RunnableScript>;
};

type Params = {
  readonly scripts: ReadonlyArray<RunnableScript>;
};

export const groupScriptsByPackage = ({ scripts }: Params): ReadonlyArray<ScriptPackageSection> => {
  const sections = new Map<string, ScriptPackageSection & { scripts: Array<RunnableScript> }>();
  for (const script of scripts) {
    const key = JSON.stringify([script.source, script.relDir]);
    const section = sections.get(key);
    if (section !== undefined) {
      section.scripts.push(script);
      continue;
    }
    sections.set(key, {
      key,
      source: script.source,
      packageName: script.packageName,
      relDir: script.relDir,
      scripts: [script],
    });
  }
  return [...sections.values()];
};
