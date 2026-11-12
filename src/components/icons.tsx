import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

const STAR = 'M12 2.2l2.95 6.1 6.7.92-4.9 4.63 1.2 6.65L12 17.3l-5.95 3.2 1.2-6.65-4.9-4.63 6.7-.92z';

export function StarIcon({ size = 20, filled = true, color = colors.sun, edge = colors.sunDark }: { size?: number; filled?: boolean; color?: string; edge?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* little 3D: darker copy underneath */}
      <Path d={STAR} transform="translate(0 1.4)" fill={filled ? edge : '#D8D2EE'} />
      <Path d={STAR} fill={filled ? color : '#EEEAF9'} stroke={filled ? edge : '#D8D2EE'} strokeWidth={1} strokeLinejoin="round" />
      {filled && <Path d="M9 7.5l1.2-2.4" stroke="#FFF6CF" strokeWidth={1.6} strokeLinecap="round" />}
    </Svg>
  );
}

export function FlameIcon({ size = 20, active = true }: { size?: number; active?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2c1 3.2 4.8 5.6 4.8 10.4A4.8 4.8 0 0 1 12 22a6 6 0 0 1-6-6c0-3 1.6-4.6 2.6-6.3.4 1.6 1.2 2.6 2.2 3C10.6 9.4 11 5.6 12 2z"
        fill={active ? '#FF7A3D' : '#D8D2EE'}
      />
      <Path d="M12 12.5c.6 1.6 2.4 2.6 2.4 4.8a2.4 2.4 0 0 1-4.8 0c0-1.5.9-2.3 1.3-3 .2.6.5 1 .9 1.2-.1-1.2 0-2.1.2-3z" fill={active ? '#FFD54A' : '#EEEAF9'} />
    </Svg>
  );
}

export function BackIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ExpandIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CompassRose({ size = 54 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 54 54">
      <Circle cx={27} cy={29} r={22} fill="rgba(42,31,92,0.12)" />
      <Circle cx={27} cy={27} r={22} fill="rgba(255,255,255,0.85)" stroke="#fff" strokeWidth={2} />
      <Path d="M27 9l5 18h-10z" fill={colors.coral} />
      <Path d="M27 45l-5-18h10z" fill={colors.inkSoft} />
      <Path d="M9 27l18-4v8zM45 27l-18 4v-8z" fill="#C9C1E8" />
      <Circle cx={27} cy={27} r={2.6} fill={colors.ink} />
    </Svg>
  );
}

export function SpeakerIcon({ size = 20, on = true, color = colors.ink }: { size?: number; on?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {on ? (
        <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      ) : (
        <Path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke={colors.coral} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function MusicIcon({ size = 20, on = true, color = colors.ink }: { size?: number; on?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 17.5V6l10-2v11.5" fill="none" stroke={on ? color : '#B5ADD3'} strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={6.5} cy={17.5} r={2.6} fill={on ? color : '#B5ADD3'} />
      <Circle cx={16.5} cy={15.5} r={2.6} fill={on ? color : '#B5ADD3'} />
      {!on && <Path d="M4 4l16 16" stroke={colors.coral} strokeWidth={2.4} strokeLinecap="round" />}
    </Svg>
  );
}

export function PuzzleIcon({ size = 24, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 8h3.2a2.3 2.3 0 1 1 4.6 0H15v3.2a2.3 2.3 0 1 1 0 4.6V19H11.8a2.3 2.3 0 1 0-4.6 0H4z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Wave with a play/pause badge: toggles ambient motion. */
export function MotionIcon({ size = 20, on = true, color = colors.ink }: { size?: number; on?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 14c2.5-3 5-3 7.5 0s5 3 7.5 0" fill="none" stroke={on ? colors.sky : '#B5ADD3'} strokeWidth={2.4} strokeLinecap="round" />
      {on ? (
        <Path d="M16 3.5v7M20 3.5v7" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      ) : (
        <Path d="M16 3l5 3.5-5 3.5z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      )}
    </Svg>
  );
}
