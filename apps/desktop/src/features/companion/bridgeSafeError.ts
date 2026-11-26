export class BridgeSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeSafeError';
  }
}
