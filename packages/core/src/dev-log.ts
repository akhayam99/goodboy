export const devWarn = (message: string): void => {
  const env = typeof process !== 'undefined' && process.env ? process.env['NODE_ENV'] : undefined;
  if (env !== 'production') {
    console.warn(message);
  }
};
