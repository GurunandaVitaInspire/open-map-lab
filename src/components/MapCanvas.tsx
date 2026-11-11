import { memo } from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { MapData, View } from '../data/maps';
import { rate } from '../lib/game';
import { colors } from '../theme';

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
};

/** The base map. Memoised so dragging a piece never re-renders hundreds of paths. */
function MapCanvasImpl({ data, view, scale, scores, showBorders, showInner, focusGroup, attempt }: Props) {
  const px = (n: number) => n / scale; // screen px → map units (for stroke widths)
  const target = attempt ? data.regions.find((r) => r.id === attempt.id) : undefined;

  const baseFill = (group?: string) => (focusGroup && group !== focusGroup ? colors.landFaded : colors.land);
  const unanswered = data.regions.filter((r) => scores[r.id] === undefined);
  const answered = data.regions.filter((r) => scores[r.id] !== undefined);

  return (
    <Svg width={view.w * scale} height={view.h * scale} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
      {/* Unanswered land. In Outline mode the stroke matches the fill, so internal borders vanish. */}
      <G>
        {unanswered.map((r) => {
          const fill = baseFill(r.group);
          return (
            <Path
              key={r.id}
              d={r.d}
              fill={fill}
              stroke={showBorders ? colors.landStroke : fill}
              strokeWidth={px(showBorders ? 0.8 : 0.6)}
              strokeLinejoin="round"
            />
          );
        })}
      </G>

      {/* Answered regions, coloured by how accurately they were placed */}
      <G>
        {answered.map((r) => (
          <Path
            key={r.id}
            d={r.d}
            fill={rate(scores[r.id]).fill}
            stroke={colors.landStroke}
            strokeWidth={px(0.8)}
            strokeLinejoin="round"
          />
        ))}
        {showInner &&
          answered.map((r) =>
            r.inner ? <Path key={`i-${r.id}`} d={r.inner} fill="none" stroke="rgba(22,25,29,0.28)" strokeWidth={px(0.6)} /> : null,
          )}
      </G>

      {data.border && (
        <Path d={data.border} fill="none" stroke={colors.inkSoft} strokeWidth={px(1.1)} strokeLinejoin="round" />
      )}

      {target && attempt && (
        <G>
          {/* true position */}
          <Path d={target.d} fill="none" stroke={colors.correct} strokeWidth={px(2.5)} strokeLinejoin="round" />
          {/* where the student dropped it */}
          <G transform={`translate(${attempt.dx} ${attempt.dy})`}>
            <Path
              d={target.d}
              fill="rgba(47,91,234,0.22)"
              stroke={colors.accent}
              strokeWidth={px(2)}
              strokeDasharray={`${px(6)} ${px(4)}`}
              strokeLinejoin="round"
            />
          </G>
          {Math.hypot(attempt.dx, attempt.dy) * scale > 6 && (
            <>
              <Line
                x1={target.cx + attempt.dx}
                y1={target.cy + attempt.dy}
                x2={target.cx}
                y2={target.cy}
                stroke={colors.ink}
                strokeWidth={px(1.5)}
                strokeDasharray={`${px(3)} ${px(3)}`}
              />
              <Circle cx={target.cx + attempt.dx} cy={target.cy + attempt.dy} r={px(3.5)} fill={colors.accent} />
              <Circle cx={target.cx} cy={target.cy} r={px(3.5)} fill={colors.correct} />
            </>
          )}
        </G>
      )}
    </Svg>
  );
}

export const MapCanvas = memo(MapCanvasImpl);
