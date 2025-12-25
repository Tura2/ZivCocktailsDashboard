export type DensityMode = 'comfortable' | 'compact';

export function densityGaps(mode: DensityMode) {
  return mode === 'compact'
    ? {
        page: 'space-y-4',
        grid: 'gap-3 lg:gap-4',
        tiles: 'gap-3',
      }
    : {
        page: 'space-y-6',
        grid: 'gap-4 lg:gap-6',
        tiles: 'gap-4',
      };
}
