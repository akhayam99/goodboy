import { createHash } from 'node:crypto';
import { ICNS_HEADER_BYTES } from '../tileMetrics.mjs';

export const icnsChunkDigests = (buffer) => {
  const digests = [];
  let cursor = ICNS_HEADER_BYTES;
  while (cursor + ICNS_HEADER_BYTES <= buffer.length) {
    const type = buffer.toString('ascii', cursor, cursor + 4);
    const length = buffer.readUInt32BE(cursor + 4);
    if (length < ICNS_HEADER_BYTES) {
      throw new Error(`Malformed icns chunk "${type}" of length ${length}`);
    }
    const payload = buffer.subarray(cursor + ICNS_HEADER_BYTES, cursor + length);
    digests.push(`${type}:${createHash('sha256').update(payload).digest('hex')}`);
    cursor += length;
  }
  return digests.sort();
};
