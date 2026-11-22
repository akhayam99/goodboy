type Params<Item> = {
  readonly items: ReadonlyArray<Item>;
  readonly limit: number;
};

type RecentRow<Item> = Readonly<{
  item: Item;
  index: number;
}>;

export const recentRowsOf = <Item extends { readonly kind: string }>({
  items,
  limit,
}: Params<Item>): ReadonlyArray<RecentRow<Item>> =>
  items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'row')
    .slice(0, limit);
