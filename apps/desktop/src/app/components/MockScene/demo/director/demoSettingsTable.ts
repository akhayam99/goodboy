type Row = {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
};

type ValueRow = {
  readonly value: string;
};

type SqlParams = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

export type SettingsSelect = ReadonlyArray<Row> | ReadonlyArray<ValueRow> | null;

export type SettingsExecute = {
  readonly rowsAffected: number;
  readonly rows: ReadonlyArray<Row>;
} | null;

const normalized = ({ sql }: Pick<SqlParams, 'sql'>): string =>
  sql.replace(/\s+/g, ' ').trim().toUpperCase();

type TextParams = {
  readonly params: ReadonlyArray<unknown>;
  readonly index: number;
};

type CountParams = {
  readonly count: number;
};

type WriteParams = {
  readonly key: string;
  readonly value: string;
};

type ValueKeyParams = {
  readonly params: ReadonlyArray<unknown>;
  readonly at: number;
};

const textAt = ({ params, index }: TextParams): string => {
  const value = params[index];
  return typeof value === 'string' ? value : String(value);
};

const valueKeyOf = ({ params, at }: ValueKeyParams): string =>
  `${textAt({ params, index: at })}:${textAt({ params, index: at + 1 })}`;

export const createDemoSettingsTable = () => {
  const rows = new Map<string, Row>();
  const workspaceValues = new Map<string, string>();

  const write = ({ key, value }: WriteParams): void => {
    rows.set(key, { key, value, updated_at: Date.now() });
  };

  const select = ({ sql, params }: SqlParams): SettingsSelect => {
    const text = normalized({ sql });
    if (text.includes('FROM WORKSPACE_VALUES WHERE WORKSPACE_ID = ? AND KEY = ?')) {
      const value = workspaceValues.get(valueKeyOf({ params, at: 0 }));
      return value === undefined ? [] : [{ value }];
    }
    if (!text.includes('FROM SETTINGS')) {
      return null;
    }
    if (text.includes('WHERE KEY = ?')) {
      const row = rows.get(textAt({ params, index: 0 }));
      return row === undefined ? [] : [row];
    }
    if (text.includes('SUBSTR(KEY')) {
      const prefix = textAt({ params, index: 1 });
      return [...rows.values()]
        .filter((row) => row.key.startsWith(prefix))
        .sort((left, right) => left.key.localeCompare(right.key));
    }
    return [...rows.values()];
  };

  const execute = ({ sql, params }: SqlParams): SettingsExecute => {
    const text = normalized({ sql });
    const done = ({ count }: CountParams): SettingsExecute => ({ rowsAffected: count, rows: [] });
    if (text.startsWith('INSERT INTO WORKSPACE_VALUES')) {
      const key = valueKeyOf({ params, at: 0 });
      if (text.includes('DO NOTHING') && workspaceValues.has(key)) {
        return done({ count: 0 });
      }
      workspaceValues.set(key, textAt({ params, index: 2 }));
      return done({ count: 1 });
    }
    if (text.startsWith('UPDATE WORKSPACE_VALUES')) {
      const key = valueKeyOf({ params, at: 2 });
      if (workspaceValues.get(key) !== textAt({ params, index: 4 })) {
        return done({ count: 0 });
      }
      workspaceValues.set(key, textAt({ params, index: 0 }));
      return done({ count: 1 });
    }
    if (text.startsWith('INSERT INTO SETTINGS')) {
      const key = textAt({ params, index: 0 });
      const value = textAt({ params, index: 1 });
      if (text.includes('DO NOTHING') && rows.has(key)) {
        return done({ count: 0 });
      }
      write({ key, value });
      return done({ count: 1 });
    }
    if (text.startsWith('UPDATE SETTINGS')) {
      const value = textAt({ params, index: 0 });
      const key = textAt({ params, index: 2 });
      const current = rows.get(key);
      const isGuarded = text.includes('AND VALUE = ?');
      if (current === undefined) {
        return done({ count: 0 });
      }
      if (isGuarded && current.value !== textAt({ params, index: 3 })) {
        return done({ count: 0 });
      }
      write({ key, value });
      return done({ count: 1 });
    }
    if (text.startsWith('DELETE FROM SETTINGS')) {
      const key = textAt({ params, index: 0 });
      const current = rows.get(key);
      if (current === undefined) {
        return done({ count: 0 });
      }
      if (text.includes('AND VALUE = ?') && current.value !== textAt({ params, index: 1 })) {
        return done({ count: 0 });
      }
      rows.delete(key);
      return done({ count: 1 });
    }
    return null;
  };

  return { select, execute };
};
