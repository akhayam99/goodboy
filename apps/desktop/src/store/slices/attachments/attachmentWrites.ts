import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

export const attachmentWrites = createSerialQueue();
