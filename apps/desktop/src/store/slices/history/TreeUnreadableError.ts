export class TreeUnreadableError extends Error {
  constructor() {
    super("Couldn't check for uncommitted changes. Try again.");
    this.name = 'TreeUnreadableError';
  }
}
