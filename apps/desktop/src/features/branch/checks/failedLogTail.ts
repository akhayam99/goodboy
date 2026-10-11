type Params = {
  readonly text: string;
};

export const failedLogTail = ({ text }: Params) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') {
    lines.pop();
  }
  const bytes = new TextEncoder().encode(lines.slice(-400).join('\n'));
  const start = Math.max(0, bytes.length - 65_536);
  let boundary = start;
  while (boundary < bytes.length && ((bytes[boundary] ?? 0) & 0xc0) === 0x80) {
    boundary += 1;
  }
  const tail = new TextDecoder().decode(bytes.subarray(boundary));
  const lineCount = tail.length === 0 ? 0 : tail.split('\n').length;
  return {
    text: tail,
    lineCount,
    byteCount: bytes.length - boundary,
    label: `Last ${lineCount} lines of the failed job, ${Math.ceil((bytes.length - boundary) / 1024)} KB`,
  };
};
