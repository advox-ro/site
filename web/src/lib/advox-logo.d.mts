export const ADVOX_VIEWBOX: string;
export const ADVOX_RATIO: number;
export function advoxSvg(opts?: {
  colors?: { ink: string; vox: string; acc: string | null };
  id?: string;
  attrs?: string;
}): string;
