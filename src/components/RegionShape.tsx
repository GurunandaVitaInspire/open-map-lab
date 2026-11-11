import Svg, { Path } from 'react-native-svg';
import type { Region } from '../data/maps';
import { colors } from '../theme';

type Props = {
  region: Region;
  /** pixels per map unit */
  scale: number;
  inline: boolean;
  fill?: string;
  stroke?: string;
  /** stroke width in screen px */
  strokePx?: number;
};

/** Draws a single region cropped to its own bounding box. */
export function RegionShape({ region, scale, inline, fill = colors.accentSoft, stroke = colors.accent, strokePx = 1.5 }: Props) {
  const [x0, y0, x1, y1] = region.bbox;
  const w = Math.max(x1 - x0, 0.1);
  const h = Math.max(y1 - y0, 0.1);
  const pad = strokePx / scale;
  return (
    <Svg
      width={(w + pad * 2) * scale}
      height={(h + pad * 2) * scale}
      viewBox={`${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`}
    >
      <Path d={region.d} fill={fill} stroke={stroke} strokeWidth={strokePx / scale} strokeLinejoin="round" />
      {inline && region.inner ? (
        <Path d={region.inner} fill="none" stroke={stroke} strokeOpacity={0.55} strokeWidth={(strokePx * 0.55) / scale} />
      ) : null}
    </Svg>
  );
}

/** Scale that fits a region inside a box of `box` px. */
export function fitScale(region: Region, box: number) {
  const [x0, y0, x1, y1] = region.bbox;
  return box / Math.max(x1 - x0, y1 - y0, 0.1);
}
