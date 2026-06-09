// Runtime-agnostic dev-only `console.warn`. Works in node, vite browser
// bundles, and the tauri webview. The naive `process.env.NODE_ENV` guard used
// to throw `ReferenceError: Can't find variable: process` in the webview,
// flooding DevTools on every unknown stream-json payload type.
export const devWarn = (message: string): void => {
  const env = typeof process !== 'undefined' && process.env ? process.env['NODE_ENV'] : undefined;
  if (env !== 'production') {
    console.warn(message);
  }
};
