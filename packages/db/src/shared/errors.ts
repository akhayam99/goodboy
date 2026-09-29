export class NotFoundError extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class UniqueViolationError extends Error {
  constructor(
    public readonly entity: string,
    public readonly field: string,
  ) {
    super(`unique constraint violated on ${entity}.${field}`);
    this.name = 'UniqueViolationError';
  }
}

export class NodeNotMutableError extends Error {
  constructor(public readonly id: string) {
    super(`workflow node cannot be changed: ${id}`);
    this.name = 'NodeNotMutableError';
  }
}

export class InvalidWorkflowNodeError extends Error {
  constructor(public readonly nodeKind: string) {
    super(`invalid workflow routing value: ${nodeKind}`);
    this.name = 'InvalidWorkflowNodeError';
  }
}
