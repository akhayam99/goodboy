export type Database = {
  exec(sql: string): Promise<void>
  execute(sql: string, params?: ReadonlyArray<unknown>): Promise<{ rowsAffected: number }>
  select<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<ReadonlyArray<T>>
}
