// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { PROVIDER_LIFECYCLE_COMMANDS, PROVIDER_CONNECT_CAPABILITIES } from '@goodboy/core';
import { describe, expect, it } from 'vitest';

const RUST_TABLE = readFileSync(
  join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'provider_commands.rs'),
  'utf8',
);

const asRustLiteral = (command: string): string => `"${command.replaceAll('"', '\\"')}"`;

const commandsOf = (): ReadonlyArray<string> => {
  const found: string[] = [];
  for (const entry of Object.values(PROVIDER_LIFECYCLE_COMMANDS)) {
    if (entry === undefined) {
      continue;
    }
    found.push(...Object.values(entry.install));
    found.push(...Object.values(entry.update ?? {}));
    if (entry.login !== undefined) {
      found.push(entry.login);
    }
    if (entry.logout !== undefined) {
      found.push(entry.logout);
    }
  }
  return found;
};

describe('provider command table parity', () => {
  it('lists every lifecycle command the app shows in the Rust table', () => {
    for (const command of commandsOf()) {
      expect(RUST_TABLE, command).toContain(asRustLiteral(command));
    }
  });

  it('allows only the env names the connect capabilities send', () => {
    const sent = new Set<string>();
    for (const capability of Object.values(PROVIDER_CONNECT_CAPABILITIES)) {
      for (const key of Object.keys(capability?.loginEnv ?? {})) {
        sent.add(key);
      }
    }
    for (const key of sent) {
      expect(RUST_TABLE, key).toContain(`"${key}"`);
    }
  });
});
