const PNG_SIGNATURE = '89504e470d0a1a0a';

const readWebp = ({ bytes }) => {
  const type = bytes.subarray(12, 16).toString('latin1');
  if (type === 'VP8X') {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (type === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (type === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  throw new Error(`unknown WebP chunk ${type}`);
};

export const imageSize = ({ bytes }) => {
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return readWebp({ bytes });
  }
  if (bytes.subarray(0, 8).toString('hex') === PNG_SIGNATURE) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  throw new Error('not a WebP or PNG file');
};
