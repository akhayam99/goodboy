export class OpenQuestionDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenQuestionDeliveryError';
  }
}
