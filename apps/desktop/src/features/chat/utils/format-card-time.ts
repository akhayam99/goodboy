const FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export const formatCardTime = (isoAt: string): string => {
  return FMT.format(new Date(isoAt))
}
