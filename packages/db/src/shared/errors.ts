export class NotFoundError extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class UniqueViolationError extends Error {
  constructor(
    public readonly entity: string,
    public readonly field: string,
  ) {
    super(`unique constraint violated on ${entity}.${field}`)
    this.name = 'UniqueViolationError'
  }
}
