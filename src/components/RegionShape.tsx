import Svg, { G, Path } from 'react-native-svg';
import type { Region } from '../data/maps';
import { colors } from '../theme';

type Props = {
  region: Region;
  /** pixels per map unit */
  scale: number;
  inline: boolean;
  fill?: string;
  side?: string;
  stroke?: string;
  /** stroke width in screen px */
  strokePx?: number;
  /** thickness of the 3D extrusion in screen px (0 = flat) */
  depthPx?: number;
  /** soft shadow below, for a "lifted" piece */
  shadow?: boolean;
};

/** Draws a single region cropped to its own bounding box, as a little 3D tile. */
export function RegionShape({
  region,
  scale,
  inline,
  fill = colors.primarySoft,
  side = '#B8A8FF',
  stroke = colors.primary,
  strokePx = 1.5,
  depthPx = 0,
  shadow = false,
}: Props) {
  const [x0, y0, x1, y1] = region.bbox;
  const w = Math.max(x1 - x0, 0.1);
  const h = Math.max(y1 - y0, 0.1);
  const pad = strokePx / scale;
  const depth = depthPx / scale;
  const shadowOff = shadow ? depth * 2.5 + 6 / scale : 0;
  const extraH = depth + shadowOff;
  return (
    <Svg
      width={(w + pad * 2 + shadowOff) * scale}
      height={(h + pad * 2 + extraH) * scale}
      viewBox={`${x0 - pad} ${y0 - pad} ${w + pad * 2 + shadowOff} ${h + pad * 2 + extraH}`}
    >
      {shadow && (
        <G transform={`translate(${shadowOff * 0.5} ${shadowOff})`} opacity={0.18}>
          <Path d={region.d} fill={colors.shadow} />
        </G>
      )}
      {depth > 0 && (
        <G transform={`translate(0 ${depth})`}>
          <Path d={region.d} fill={side} stroke={side} strokeWidth={strokePx / scale} strokeLinejoin="round" />
        </G>
      )}
      <Path d={region.d} fill={fill} stroke={stroke} strokeWidth={strokePx / scale} strokeLinejoin="round" />
      {inline && region.inner ? (
        <Path d={region.inner} fill="none" stroke={stroke} strokeOpacity={0.5} strokeWidth={(strokePx * 0.55) / scale} />
      ) : null}
    </Svg>
  );
}

/** Scale that fits a region inside a box of `box` px. */
export function fitScale(region: Region, box: number) {
  const [x0, y0, x1, y1] = region.bbox;
  return box / Math.max(x1 - x0, y1 - y0, 0.1);
}
