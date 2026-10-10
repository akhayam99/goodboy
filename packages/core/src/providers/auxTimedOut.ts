export class AuxTimedOutError extends Error {
  constructor() {
    super('The model CLI went quiet for too long and was stopped');
    this.name = 'AuxTimedOutError';
  }
}
