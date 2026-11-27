type Props = {
  readonly byDay: ReadonlyArray<number>;
  readonly label: string;
};

export const DayBars = ({ byDay, label }: Props) => {
  const peak = Math.max(1, ...byDay);
  const days = byDay.map((count, index) => ({ key: `day-${index}`, count }));
  return (
    <span role="img" aria-label={label} className="flex h-6 min-w-0 items-end gap-0.5">
      {days.map((day) => (
        <span
          key={day.key}
          className="min-w-0 flex-1 rounded-sm bg-muted-foreground"
          style={{
            height: `${Math.max(8, (day.count / peak) * 100)}%`,
            opacity: day.count === 0 ? 0.4 : 1,
          }}
        />
      ))}
    </span>
  );
};
