// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const TAURI = join(__dirname, '..', '..', '..', 'src-tauri');

type Capability = {
  readonly windows: readonly string[];
  readonly permissions: readonly string[];
};

type Ledger = {
  readonly 'every-window': readonly string[];
  readonly 'main-only': readonly string[];
};

const readLedger = (): Ledger =>
  JSON.parse(readFileSync(join(TAURI, 'window-commands.json'), 'utf8'));

const readCapability = (): Capability =>
  JSON.parse(readFileSync(join(TAURI, 'capabilities', 'default.json'), 'utf8'));

const registeredCommands = (): readonly string[] => {
  const source = readFileSync(join(TAURI, 'src', 'lib.rs'), 'utf8');
  const start = source.indexOf('generate_handler![');
  const end = source.indexOf('])', start);
  return source
    .slice(start + 'generate_handler!['.length, end)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.split('::').pop() ?? entry);
};

const duplicates = (names: readonly string[]) =>
  names.filter((name, index) => names.indexOf(name) !== index);

const NOTIFICATION_PERMISSIONS = [
  'notification:allow-is-permission-granted',
  'notification:allow-notify',
  'notification:allow-register-listener',
  'notification:allow-remove-listener',
  'notification:allow-request-permission',
];

describe('the native alerts each window type may use', () => {
  it('lets every window raise a banner and listen for its click, and nothing more of the plugin', () => {
    const granted = readCapability().permissions.filter((name) => name.startsWith('notification:'));
    expect([...granted].sort()).toEqual(NOTIFICATION_PERMISSIONS);
  });

  it('lets every window set the dock badge, which only the main window writes', () => {
    expect(readCapability().permissions).toContain('core:window:allow-set-badge-count');
  });

  it('never grants the whole notification set, which can schedule and cancel', () => {
    expect(readCapability().permissions).not.toContain('notification:default');
  });
});

describe('the commands each window type may call', () => {
  it('knows every window class the capability grants', () => {
    expect(readCapability().windows).toEqual(['main', 'win-*']);
  });

  it('assigns every registered command to a window type', () => {
    const ledger = readLedger();
    const assigned = new Set([...ledger['every-window'], ...ledger['main-only']]);
    const missing = registeredCommands().filter((name) => !assigned.has(name));
    expect(missing).toEqual([]);
  });

  it('lists no command that is not registered', () => {
    const ledger = readLedger();
    const registered = new Set(registeredCommands());
    const stale = [...ledger['every-window'], ...ledger['main-only']].filter(
      (name) => !registered.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('puts each command in one window type only, in sorted order', () => {
    const ledger = readLedger();
    expect(duplicates([...ledger['every-window'], ...ledger['main-only']])).toEqual([]);
    expect([...ledger['every-window']]).toEqual([...ledger['every-window']].sort());
    expect([...ledger['main-only']]).toEqual([...ledger['main-only']].sort());
  });

  it('registers each command once', () => {
    expect(duplicates(registeredCommands())).toEqual([]);
  });
});
