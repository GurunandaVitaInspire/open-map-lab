import { memo } from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { MapData, Region, View } from '../data/maps';
import { colors, rate } from '../theme';

export type Attempt = { id: string; dx: number; dy: number };

type Props = {
  data: MapData;
  view: View;
  /** pixels per map unit */
  scale: number;
  /** accuracy (0–100) of every region answered so far */
  scores: Record<string, number>;
  /** draw region borders on the base map (Inline mode); Outline mode shows only the outer border */
  showBorders: boolean;
  /** draw internal (district) lines inside answered regions */
  showInner: boolean;
  /** when set, regions outside this group are drawn faded as context */
  focusGroup?: string;
  /** the last drop: piece drawn where the student put it, next to its true position */
  attempt?: Attempt | null;
  /** custom top/side colours for answered regions (e.g. puzzle pieces); default is the score colour */
  fills?: Record<string, { fill: string; side: string }>;
};

/**
 * The base map, drawn as a chunky 3D slab: a soft drop shadow, an extruded sandy side, then the top
 * face. Answered regions rise out of the slab in their score colour.
 * Memoised so dragging a piece never re-renders hundreds of paths.
 */
function MapCanvasImpl({ data, view, scale, scores, showBorders, showInner, focusGroup, attempt, fills }: Props) {
  const px = (n: number) => n / scale; // screen px → map units
  const depth = px(Math.max(3, Math.min(9, scale * 9))); // slab thickness, scaled with map size
  const rise = depth * 0.7; // how far answered regions pop up
  const target = attempt ? data.regions.find((r) => r.id === attempt.id) : undefined;

  const faded = (r: Region) => !!focusGroup && r.group !== focusGroup;
  const answered = data.regions.filter((r) => scores[r.id] !== undefined);
  const unanswered = data.regions.filter((r) => scores[r.id] === undefined);

  return (
    <Svg width={view.w * scale} height={view.h * scale} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
      {/* drop shadow on the sea */}
      <G transform={`translate(${depth * 0.6} ${depth * 2.2})`} opacity={0.16}>
        {data.regions.map((r) => (
          <Path key={r.id} d={r.d} fill={colors.shadow} stroke={colors.shadow} strokeWidth={px(3)} strokeLinejoin="round" />
        ))}
      </G>
      {/* extruded side of the slab */}
      <G transform={`translate(0 ${depth})`}>
        {data.regions.map((r) => {
          const c = faded(r) ? colors.landFadedSide : colors.landSide;
          return <Path key={r.id} d={r.d} fill={c} stroke={c} strokeWidth={px(1)} strokeLinejoin="round" />;
        })}
      </G>

      {/* top face of unanswered land. In Outline mode the stroke matches the fill, hiding internal borders */}
      <G>
        {unanswered.map((r) => {
          const fill = faded(r) ? colors.landFadedTop : colors.landTop;
          return (
            <Path
              key={r.id}
              d={r.d}
              fill={fill}
              stroke={showBorders ? colors.landStroke : fill}
              strokeWidth={px(showBorders ? 1 : 1.6)}
              strokeLinejoin="round"
            />
          );
        })}
      </G>

      {data.border && <Path d={data.border} fill="none" stroke={colors.border} strokeWidth={px(1.3)} strokeLinejoin="round" />}

      {/* answered regions pop out of the slab */}
      {answered.map((r) => {
        const rt = fills?.[r.id] ?? rate(scores[r.id]);
        return (
          <G key={r.id}>
            <Path d={r.d} fill={rt.side} stroke={rt.side} strokeWidth={px(1)} strokeLinejoin="round" />
            <G transform={`translate(0 ${-rise})`}>
              <Path d={r.d} fill={rt.fill} stroke="#fff" strokeWidth={px(1.2)} strokeLinejoin="round" />
              {showInner && r.inner ? <Path d={r.inner} fill="none" stroke="rgba(34,24,74,0.25)" strokeWidth={px(0.6)} /> : null}
            </G>
          </G>
        );
      })}

      {target && attempt && (
        <G>
          {/* true position */}
          <G transform={`translate(0 ${-rise})`}>
            <Path d={target.d} fill="none" stroke={colors.mint} strokeWidth={px(3)} strokeLinejoin="round" />
          </G>
          {/* where the student dropped it */}
          {Math.hypot(attempt.dx, attempt.dy) * scale > 2 && (
            <G transform={`translate(${attempt.dx} ${attempt.dy - rise})`}>
              <Path
                d={target.d}
                fill="rgba(108,71,255,0.2)"
                stroke={colors.primary}
                strokeWidth={px(2.2)}
                strokeDasharray={`${px(6)} ${px(4)}`}
                strokeLinejoin="round"
              />
            </G>
          )}
          {Math.hypot(attempt.dx, attempt.dy) * scale > 8 && (
            <>
              <Line
                x1={target.cx + attempt.dx}
                y1={target.cy + attempt.dy - rise}
                x2={target.cx}
                y2={target.cy - rise}
                stroke={colors.ink}
                strokeWidth={px(1.8)}
                strokeDasharray={`${px(3)} ${px(3)}`}
              />
              <Circle cx={target.cx + attempt.dx} cy={target.cy + attempt.dy - rise} r={px(4)} fill={colors.primary} stroke="#fff" strokeWidth={px(1.5)} />
              <Circle cx={target.cx} cy={target.cy - rise} r={px(4)} fill={colors.mint} stroke="#fff" strokeWidth={px(1.5)} />
            </>
          )}
        </G>
      )}
    </Svg>
  );
}

export const MapCanvas = memo(MapCanvasImpl);
