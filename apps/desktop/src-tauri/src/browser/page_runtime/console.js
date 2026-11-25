const LEVELS = [
  ['log', 'log'],
  ['info', 'info'],
  ['debug', 'log'],
  ['warn', 'warn'],
  ['error', 'error'],
];

const recordConsole = (level, textOf, sourceOf) =>
  guarded(() =>
    store({
      kind: 'console',
      level,
      text: clip(textOf(), MAX_TEXT),
      source: sourceOf(),
      method: null,
      status: null,
      network: null,
      error: null,
    }),
  );

const errorStackOfArgs = (args, stack) => {
  for (let index = 0; index < args.length; index += 1) {
    const found = errorStackOf(args[index]);
    if (found !== null) {
      return found;
    }
  }
  return stackOf(stack, HOOK_FRAME);
};

const recordCall = (level, args, stack) => {
  if (level === 'error') {
    recordError(
      'console',
      () => textOfArgs(args),
      () => sourceOfStack(stack, HOOK_FRAME),
      () => errorStackOfArgs(args, stack),
    );
    return;
  }
  recordConsole(
    level,
    () => textOfArgs(args),
    () => sourceOfStack(stack, HOOK_FRAME),
  );
};

const cons = window.console;
if (cons != null) {
  for (let index = 0; index < LEVELS.length; index += 1) {
    const name = LEVELS[index][0];
    const level = LEVELS[index][1];
    const original = cons[name];
    if (typeof original !== 'function') {
      continue;
    }
    cons[name] = function goodboyConsoleHook() {
      if (!isBusy) {
        const args = arguments;
        let stack = null;
        try {
          stack = new Error().stack;
        } catch {
          stack = null;
        }
        recordCall(level, args, stack);
      }
      return original.apply(this, arguments);
    };
  }
}
