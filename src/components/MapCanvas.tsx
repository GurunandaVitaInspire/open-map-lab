import { memo } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import type { MapData, View } from '../data/maps';
import { colors, paletteFor } from '../theme';

export type RegionStatus = 'placed' | 'revealed';

type Props = {
  data: MapData;
  view: View;
  /** pixels per map unit */
  scale: number;
  status: Record<string, RegionStatus>;
  showInner: boolean;
  /** when set, regions outside this group are drawn faded as context */
  focusGroup?: string;
  hintId?: string | null;
  flashId?: string | null;
};

/** The base map. Memoised so dragging a piece never re-renders hundreds of paths. */
function MapCanvasImpl({ data, view, scale, status, showInner, focusGroup, hintId, flashId }: Props) {
  const px = (n: number) => n / scale; // convert screen px → map units for stroke widths
  const hint = hintId ? data.regions.find((r) => r.id === hintId) : undefined;
  const flash = flashId ? data.regions.find((r) => r.id === flashId) : undefined;

  return (
    <Svg width={view.w * scale} height={view.h * scale} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
      <G>
        {data.regions.map((r) => {
          const st = status[r.id];
          return (
            <Path
              key={r.id}
              d={r.d}
              fill={st === 'placed' ? paletteFor(r.id) : st === 'revealed' ? '#F0C9C9' : focusGroup && r.group !== focusGroup ? colors.landFaded : colors.land}
              stroke={colors.landStroke}
              strokeWidth={px(0.8)}
              strokeLinejoin="round"
            />
          );
        })}
      </G>
      {showInner && (
        <G>
          {data.regions.map((r) =>
            status[r.id] && r.inner ? (
              <Path key={r.id} d={r.inner} fill="none" stroke="rgba(22,25,29,0.28)" strokeWidth={px(0.6)} />
            ) : null,
          )}
        </G>
      )}
      {data.border && (
        <Path d={data.border} fill="none" stroke={colors.inkSoft} strokeWidth={px(1.1)} strokeLinejoin="round" />
      )}
      {hint && (
        <Path
          d={hint.d}
          fill="rgba(232,155,12,0.18)"
          stroke={colors.hint}
          strokeWidth={px(2.5)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
      )}
      {flash && <Path d={flash.d} fill="none" stroke={colors.correct} strokeWidth={px(3)} strokeLinejoin="round" />}
    </Svg>
  );
}

export const MapCanvas = memo(MapCanvasImpl);
