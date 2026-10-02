const MAX_LENGTH = 64;
const ALLOWED = /^[A-Za-z0-9._-]+$/;

export const projectNameProblem = (raw: string): string | null => {
  const name = raw.trim();
  if (name === '') {
    return null;
  }
  if (name.length > MAX_LENGTH) {
    return `Keep the name under ${MAX_LENGTH} characters`;
  }
  if (!ALLOWED.test(name)) {
    return 'Use letters, numbers, dashes, dots and underscores';
  }
  if (name.startsWith('.') || name.startsWith('-')) {
    return 'Start the name with a letter or a number';
  }
  if (name.endsWith('.')) {
    return 'End the name with a letter or a number';
  }
  return null;
};

export const joinPath = ({ parent, name }: { readonly parent: string; readonly name: string }) => {
  const separator = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return `${parent.replace(/[\\/]+$/, '')}${separator}${name.trim()}`;
};
