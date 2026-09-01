import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUST_SOURCE_PATH = resolve(ROOT_DIRECTORY, 'apps/desktop/src-tauri/src/lib.rs');
const PROVIDERS_SOURCE_PATH = resolve(
  ROOT_DIRECTORY,
  'apps/desktop/src/features/providers/providers.ts',
);
const FRONTEND_SOURCE_DIRECTORIES = [
  resolve(ROOT_DIRECTORY, 'apps/desktop/src'),
  resolve(ROOT_DIRECTORY, 'packages'),
];
const ALLOWLIST_REASON_BY_COMMAND = new Map([]);

const collectSourceFiles = ({ directory }) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles({ directory: path }));
      continue;
    }
    if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
};

const collectRegisteredCommands = ({ source }) => {
  const commands = new Set();
  const handlerPattern = /tauri::generate_handler!\s*\[([\s\S]*?)\]/g;
  for (const handlerMatch of source.matchAll(handlerPattern)) {
    const commandPattern = /(?:[A-Za-z_]\w*::)+([A-Za-z_]\w*)/g;
    for (const commandMatch of handlerMatch[1].matchAll(commandPattern)) {
      commands.add(commandMatch[1]);
    }
  }
  return commands;
};

const collectLiteralInvocations = ({ source }) => {
  const commands = new Set();
  const invokePattern =
    /\b(?:this\.)?(?:invoke|invokeDb|invokeFn)(?:\s*<[^()]*>)?\s*\(\s*(['"`])([^'"`]+)\1/g;
  for (const match of source.matchAll(invokePattern)) {
    commands.add(match[2]);
  }
  return commands;
};

const collectMapValues = ({ source, mapName }) => {
  const objectPattern = new RegExp(`${mapName}[^=]*=\\s*\\{([\\s\\S]*?)\\};`);
  const objectMatch = source.match(objectPattern);
  if (objectMatch === null) {
    throw new Error(`Could not find ${mapName} object literal`);
  }
  const commands = new Set();
  const valuePattern = /:\s*(['"`])([^'"`]+)\1/g;
  for (const match of objectMatch[1].matchAll(valuePattern)) {
    commands.add(match[2]);
  }
  return commands;
};

const difference = ({ left, right }) =>
  [...left].filter((command) => !right.has(command) && !ALLOWLIST_REASON_BY_COMMAND.has(command));

for (const [command, reason] of ALLOWLIST_REASON_BY_COMMAND) {
  if (command.length === 0 || reason.trim().length === 0) {
    throw new Error('Every allowlisted command needs a name and reason');
  }
}

const registeredCommands = collectRegisteredCommands({
  source: readFileSync(RUST_SOURCE_PATH, 'utf8'),
});
if (registeredCommands.size === 0) {
  throw new Error('No commands found in tauri::generate_handler! blocks');
}

const invokedCommands = new Set();
for (const directory of FRONTEND_SOURCE_DIRECTORIES) {
  for (const path of collectSourceFiles({ directory })) {
    const commands = collectLiteralInvocations({ source: readFileSync(path, 'utf8') });
    for (const command of commands) {
      invokedCommands.add(command);
    }
  }
}

const providersSource = readFileSync(PROVIDERS_SOURCE_PATH, 'utf8');
for (const mapName of ['TAURI_GET_CMD', 'TAURI_REFRESH_CMD']) {
  const commands = collectMapValues({ source: providersSource, mapName });
  for (const command of commands) {
    invokedCommands.add(command);
  }
}

const unregisteredCommands = difference({ left: invokedCommands, right: registeredCommands });
const uninvokedCommands = difference({ left: registeredCommands, right: invokedCommands });

if (unregisteredCommands.length > 0 || uninvokedCommands.length > 0) {
  if (unregisteredCommands.length > 0) {
    console.error(`Invoked but not registered:\n${unregisteredCommands.sort().join('\n')}`);
  }
  if (uninvokedCommands.length > 0) {
    console.error(`Registered but never invoked:\n${uninvokedCommands.sort().join('\n')}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Tauri command parity OK: ${registeredCommands.size} registered, ${invokedCommands.size} invoked`,
  );
}
