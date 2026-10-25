export const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'was', 'will'];

export const BOOLEAN_NAME = new RegExp(`^(?:${BOOLEAN_PREFIXES.join('|')})[A-Z0-9]`);
