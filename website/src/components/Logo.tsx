import { DogMascot } from './DogMascot'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <DogMascot size={size} className="text-[oklch(0.78_0.13_200)]" />
      <span className="text-[17px] font-semibold tracking-tight">Goodboy</span>
    </div>
  )
}
