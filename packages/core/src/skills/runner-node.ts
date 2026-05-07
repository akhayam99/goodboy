import { execFile } from 'node:child_process';
import type { SkillScriptRunner } from './executor';
import { SkillScriptError } from './executor';

function runScript(scriptPath: string, args: ReadonlyArray<string>, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('bash', [scriptPath, ...args], { cwd }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(new SkillScriptError(error.message, stderr));
        return;
      }
      resolve(stdout);
    });
  });
}

export const nodeSkillScriptRunner: SkillScriptRunner = { runScript };
