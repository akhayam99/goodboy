const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const COMMAND = /[MLHVCSQTAZmlhvcsqtaz]/;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/i;
const FLAG = /^[01]/;
const SEPARATOR = /^[\s,]+/;
const TRANSFORM = /(translate|rotate)\(([^)]*)\)/g;
const GRID = 256;

const readNumbers = ({ text, letter }) => {
  const numbers = [];
  let rest = text;
  const isArc = letter.toLowerCase() === 'a';
  while (rest.length > 0) {
    rest = rest.replace(SEPARATOR, '');
    if (rest.length === 0) {
      break;
    }
    const slot = numbers.length % 7;
    const pattern = isArc && (slot === 3 || slot === 4) ? FLAG : NUMBER;
    const match = rest.match(pattern);
    if (match == null) {
      throw new Error(`unreadable path data near "${rest.slice(0, 12)}"`);
    }
    numbers.push(Number(match[0]));
    rest = rest.slice(match[0].length);
  }
  return numbers;
};

const commandsOf = ({ d }) => {
  const commands = [];
  let rest = d.trim();
  while (rest.length > 0) {
    const letter = rest[0];
    if (!COMMAND.test(letter)) {
      throw new Error(`path data must start with a command, got "${rest.slice(0, 12)}"`);
    }
    const next = rest.slice(1).search(COMMAND);
    const body = next === -1 ? rest.slice(1) : rest.slice(1, next + 1);
    commands.push({ letter, numbers: readNumbers({ text: body, letter }) });
    rest = next === -1 ? '' : rest.slice(next + 1);
  }
  return commands;
};

const absoluteSegmentsOf = ({ d }) => {
  const segments = [];
  const pen = { x: 0, y: 0 };
  const start = { x: 0, y: 0 };
  for (const { letter, numbers } of commandsOf({ d })) {
    const kind = letter.toLowerCase();
    const isRelative = letter === kind;
    const arity = ARITY[kind];
    if (arity === 0) {
      segments.push({ kind: 'z', values: [] });
      Object.assign(pen, start);
      continue;
    }
    for (let index = 0; index < numbers.length; index += arity) {
      const chunk = numbers.slice(index, index + arity);
      const offsetX = isRelative ? pen.x : 0;
      const offsetY = isRelative ? pen.y : 0;
      const segmentKind = kind === 'm' && index > 0 ? 'l' : kind;
      if (segmentKind === 'h') {
        pen.x = chunk[0] + offsetX;
        segments.push({ kind: 'l', values: [pen.x, pen.y] });
        continue;
      }
      if (segmentKind === 'v') {
        pen.y = chunk[0] + offsetY;
        segments.push({ kind: 'l', values: [pen.x, pen.y] });
        continue;
      }
      if (segmentKind === 'a') {
        const [rx, ry, rotation, largeArc, sweep, x, y] = chunk;
        pen.x = x + offsetX;
        pen.y = y + offsetY;
        segments.push({ kind: 'a', values: [rx, ry, rotation, largeArc, sweep, pen.x, pen.y] });
        continue;
      }
      const values = chunk.map((value, position) =>
        position % 2 === 0 ? value + offsetX : value + offsetY,
      );
      pen.x = values[values.length - 2];
      pen.y = values[values.length - 1];
      if (segmentKind === 'm') {
        Object.assign(start, pen);
      }
      segments.push({ kind: segmentKind, values });
    }
  }
  return segments;
};

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const multiply = ({ left, right }) => ({
  a: left.a * right.a + left.c * right.b,
  b: left.b * right.a + left.d * right.b,
  c: left.a * right.c + left.c * right.d,
  d: left.b * right.c + left.d * right.d,
  e: left.a * right.e + left.c * right.f + left.e,
  f: left.b * right.e + left.d * right.f + left.f,
});

const matrixOfStep = ({ name, values }) => {
  if (name === 'translate') {
    return { ...IDENTITY, e: values[0] ?? 0, f: values[1] ?? 0 };
  }
  const radians = ((values[0] ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = values[1] ?? 0;
  const cy = values[2] ?? 0;
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy,
  };
};

const matrixOf = ({ transform }) => {
  if (transform == null) {
    return IDENTITY;
  }
  const steps = [...transform.matchAll(TRANSFORM)];
  if (transform.replace(TRANSFORM, '').trim() !== '') {
    throw new Error(`unsupported transform "${transform}"`);
  }
  return steps.reduce(
    (matrix, [, name, args]) =>
      multiply({
        left: matrix,
        right: matrixOfStep({ name, values: args.trim().split(/[\s,]+/).map(Number) }),
      }),
    IDENTITY,
  );
};

const applyMatrix = ({ segments, matrix, scale }) => {
  const angle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  const point = ({ x, y }) => [
    (matrix.a * x + matrix.c * y + matrix.e) * scale,
    (matrix.b * x + matrix.d * y + matrix.f) * scale,
  ];
  return segments.map(({ kind, values }) => {
    if (kind === 'z') {
      return { kind, values };
    }
    if (kind === 'a') {
      const [rx, ry, rotation, largeArc, sweep, x, y] = values;
      return {
        kind,
        values: [rx * scale, ry * scale, rotation + angle, largeArc, sweep, ...point({ x, y })],
      };
    }
    const moved = [];
    for (let index = 0; index < values.length; index += 2) {
      moved.push(...point({ x: values[index], y: values[index + 1] }));
    }
    return { kind, values: moved };
  });
};

const signedAreaOf = ({ points }) =>
  points.reduce((area, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return area + (x * nextY - nextX * y);
  }, 0) / 2;

const outerSignOf = ({ segments }) => {
  const contours = [];
  for (const { kind, values } of segments) {
    if (kind === 'm') {
      contours.push([]);
    }
    if (kind !== 'z') {
      contours[contours.length - 1].push(values.slice(-2));
    }
  }
  const areas = contours.map((points) => signedAreaOf({ points }));
  const outer = areas.reduce((best, area) => (Math.abs(area) > Math.abs(best) ? area : best), 0);
  return Math.sign(outer);
};

const circleSegments = ({ cx, cy, r, sign }) => {
  const sweep = sign >= 0 ? 1 : 0;
  return [
    { kind: 'm', values: [cx - r, cy] },
    { kind: 'a', values: [r, r, 0, 1, sweep, cx + r, cy] },
    { kind: 'a', values: [r, r, 0, 1, sweep, cx - r, cy] },
    { kind: 'z', values: [] },
  ];
};

const polygonSegments = ({ points, sign }) => {
  const area = signedAreaOf({ points });
  const ordered = Math.sign(area) === sign || sign === 0 ? points : [...points].reverse();
  return [
    { kind: 'm', values: ordered[0] },
    ...ordered.slice(1).map((values) => ({ kind: 'l', values })),
    { kind: 'z', values: [] },
  ];
};

const roundedRectSegments = ({ x, y, width, height, radius, sign }) => {
  const sweep = sign >= 0 ? 1 : 0;
  const right = x + width;
  const bottom = y + height;
  const clockwise = [
    { kind: 'm', values: [x + radius, y] },
    { kind: 'l', values: [right - radius, y] },
    { kind: 'a', values: [radius, radius, 0, 0, sweep, right, y + radius] },
    { kind: 'l', values: [right, bottom - radius] },
    { kind: 'a', values: [radius, radius, 0, 0, sweep, right - radius, bottom] },
    { kind: 'l', values: [x + radius, bottom] },
    { kind: 'a', values: [radius, radius, 0, 0, sweep, x, bottom - radius] },
    { kind: 'l', values: [x, y + radius] },
    { kind: 'a', values: [radius, radius, 0, 0, sweep, x + radius, y] },
    { kind: 'z', values: [] },
  ];
  if (sweep === 1) {
    return clockwise;
  }
  return [
    { kind: 'm', values: [x + radius, y] },
    { kind: 'a', values: [radius, radius, 0, 0, 0, x, y + radius] },
    { kind: 'l', values: [x, bottom - radius] },
    { kind: 'a', values: [radius, radius, 0, 0, 0, x + radius, bottom] },
    { kind: 'l', values: [right - radius, bottom] },
    { kind: 'a', values: [radius, radius, 0, 0, 0, right, bottom - radius] },
    { kind: 'l', values: [right, y + radius] },
    { kind: 'a', values: [radius, radius, 0, 0, 0, right - radius, y] },
    { kind: 'z', values: [] },
  ];
};

const isHidden = ({ attrs }) =>
  attrs.fill === 'none' ||
  attrs.opacity === '0' ||
  attrs['data-icon-path'] === 'inner-path' ||
  attrs['data-name'] === '<Transparent Rectangle>';

const shapeSegments = ({ elem, attrs, sign }) => {
  if (elem === 'path') {
    return absoluteSegmentsOf({ d: attrs.d });
  }
  if (elem === 'circle' || elem === 'ellipse') {
    const r = Number(attrs.r ?? attrs.rx);
    if (elem === 'ellipse' && attrs.rx !== attrs.ry) {
      throw new Error('an ellipse that is not a circle is not supported');
    }
    return circleSegments({ cx: Number(attrs.cx ?? 0), cy: Number(attrs.cy ?? 0), r, sign });
  }
  if (elem === 'rect') {
    const x = Number(attrs.x ?? 0);
    const y = Number(attrs.y ?? 0);
    const width = Number(attrs.width);
    const height = Number(attrs.height);
    const radius = Math.min(Number(attrs.rx ?? attrs.ry ?? 0), width / 2, height / 2);
    if (radius > 0) {
      return roundedRectSegments({ x, y, width, height, radius, sign });
    }
    const corners = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ];
    return polygonSegments({ points: corners, sign });
  }
  if (elem === 'polygon') {
    const numbers = attrs.points.trim().split(/[\s,]+/).map(Number);
    const points = [];
    for (let index = 0; index < numbers.length; index += 2) {
      points.push([numbers[index], numbers[index + 1]]);
    }
    return polygonSegments({ points, sign });
  }
  throw new Error(`unsupported element ${elem}`);
};

const formatNumber = ({ value }) => String(Math.round(value * 1000) / 1000);

const dOf = ({ segments }) =>
  segments
    .map(({ kind, values }) => {
      if (kind === 'z') {
        return 'Z';
      }
      return kind.toUpperCase() + values.map((value) => formatNumber({ value })).join(',');
    })
    .join('');

const viewBoxSizeOf = ({ descriptor }) => {
  const [, , width, height] = descriptor.attrs.viewBox.split(/\s+/).map(Number);
  if (width !== height) {
    throw new Error(`${descriptor.name} is not drawn on a square grid`);
  }
  return width;
};

export const carbonPathOf = ({ descriptor }) => {
  const scale = GRID / viewBoxSizeOf({ descriptor });
  const shapes = descriptor.content.filter((shape) => !isHidden({ attrs: shape.attrs }));
  const pathSigns = shapes
    .filter((shape) => shape.elem === 'path')
    .map((shape) => outerSignOf({ segments: absoluteSegmentsOf({ d: shape.attrs.d }) }));
  const sum = pathSigns.reduce((total, sign) => total + sign, 0);
  const sign = sum === 0 ? 1 : Math.sign(sum);
  return dOf({
    segments: shapes.flatMap(({ elem, attrs }) =>
      applyMatrix({
        segments: shapeSegments({ elem, attrs, sign }),
        matrix: matrixOf({ transform: attrs.transform }),
        scale,
      }),
    ),
  });
};
