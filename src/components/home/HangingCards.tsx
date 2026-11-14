import { memo, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { IS_WEB } from '../../lib/cssAnim';
import { haptic } from '../../lib/feel';
import { useMotion } from '../../lib/motion';
import { playSfx } from '../../lib/sound';
import { colors, fonts } from '../../theme';
import { StarIcon } from '../icons';
import { Looping } from '../Looping';
import { makeCable } from './cable';

const NATIVE = Platform.OS !== 'web';

export type HangingItem = {
  key: string;
  title: string;
  subtitle: string;
  art: ReactNode;
  tint: string;
  clip: string;
  clipDark: string;
  stars: number;
  note?: string;
};

type Props = {
  items: HangingItem[];
  onPick: (key: string) => void;
  board: boolean;
  s: (n: number) => number;
  /** card size budget (px) so several ropes fit on one screen */
  maxCardW?: number;
  /** card height ÷ width */
  ratio?: number;
  /** art panel height ÷ card width */
  artRatio?: number;
  /** how far the rope dips in the middle (px) */
  sag?: number;
  /** entrance delay offset, so a second rope drops in after the first */
  delayBase?: number;
  showSwipe?: boolean;
};

/**
 * Polaroid-style game cards pegged to a cable, like cars on a cable-car line. The cable hangs by
 * real physics (see cable.ts): straight stretches between cards and a bend at each card under its
 * weight. As each card drops in, its weight lands on the cable, which dips and bounces, carrying
 * the other cards with it.
 *
 * The rope is also a toy: grab it anywhere and pull it up or down. It bends at your finger, the
 * cards ride along and tilt with it (their pegs clamp them to the rope), they swing and shake as
 * it moves, and when you let go it springs back and bounces until it settles.
 */
export function HangingCards({ items, onPick, board, s, maxCardW, ratio, artRatio = 0.78, sag: sagProp, delayBase = 0, showSwipe = true }: Props) {
  const [width, setWidth] = useState(0);
  const gap = board ? s(26) : 16;
  const pad = board ? s(30) : 20;
  const cardW = board
    ? Math.min(maxCardW ?? s(250), (width - pad * 2 - gap * (items.length - 1)) / items.length)
    : (maxCardW ?? 196);
  const cardH = cardW * (ratio ?? (board ? 1.24 : 1.4));
  const contentW = board ? width : pad * 2 + items.length * cardW + (items.length - 1) * gap;
  const sag = sagProp ?? (board ? s(60) : 34);
  const ropeY = board ? s(22) : 20;
  // phones: a little extra room below, because the swipeable row clips anything past its edge
  const height = ropeY + sag + cardH + s(28) + (board ? 0 : 22);

  // the cable is fixed just outside the left and right edges
  const x0 = -30;
  const x1 = contentW + 30;
  const startX = board ? (contentW - (items.length * cardW + (items.length - 1) * gap)) / 2 : pad;
  const cxs = items.map((_, i) => startX + cardW / 2 + i * (cardW + gap));
  const cxKey = cxs.map((x) => x.toFixed(1)).join(',');
  const cable = useMemo(
    () => makeCable(x0, x1, cxs, sag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x0, x1, cxKey, sag],
  );
  const rest = useMemo(() => items.map(() => 1), [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everything that moves the rope lives in one store: each card's weight (0 until it lands, then
  // it springs to 1) and a hand pulling the rope. The current numbers are kept from the moment the
  // store exists, so the rope always shows what the cards feel, however late it is drawn.
  const motion = useMotion();
  const [store] = useState(() => makeStore(items.length, motion ? 0 : 1));

  // One frame loop draws the rope, places the cards on it and swings them, all in the same frame.
  const [, setFrame] = useState(0);
  const sim = useRef({ th: items.map(() => 0), om: items.map(() => 0), raf: 0, last: 0, dirty: true });
  const geo = useRef({ cable, cxs, rest });
  geo.current = { cable, cxs, rest };
  useEffect(() => {
    const st = sim.current;
    const step = (t: number) => {
      const dt = st.last ? Math.min(0.034, (t - st.last) / 1000) : 1 / 60;
      st.last = t;
      const { cable: c, cxs: xs, rest: r } = geo.current;
      const pull = store.pullF ? { x: store.pullX, f: store.pullF } : undefined;
      let busy = st.dirty;
      st.dirty = false;
      xs.forEach((x, j) => {
        // the peg clamps the card to the rope: it wants to tilt as much as the rope tilts there…
        const lean = (Math.atan(c.slopeAt(x, store.now, pull)) - Math.atan(c.slopeAt(x, r))) * (180 / Math.PI) * 0.9;
        const target = Math.max(-MAX_TILT, Math.min(MAX_TILT, lean)); // a peg twists only so far
        // …but a card is heavy and springy, so it lags, overshoots and shakes (a damped swing)
        const acc = -SWING_K * (st.th[j] - target) - SWING_C * st.om[j];
        st.om[j] += acc * dt;
        st.th[j] += st.om[j] * dt;
        if (Math.abs(st.th[j] - target) > 0.03 || Math.abs(st.om[j]) > 0.08) busy = true;
      });
      setFrame((n) => (n + 1) % 1e6);
      st.raf = busy ? requestAnimationFrame(step) : 0;
    };
    const wake = () => {
      st.dirty = true;
      if (!st.raf) {
        st.last = 0;
        st.raf = requestAnimationFrame(step);
      }
    };
    store.subs.add(wake);
    wake();
    return () => {
      store.subs.delete(wake);
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
  }, [store]);

  // cards landing: each one's weight springs onto the cable (a little bounce)
  useEffect(() => {
    if (!motion) {
      store.loads.forEach((l) => l.setValue(1));
      return;
    }
    const landing = Animated.parallel(
      store.loads.map((l, i) =>
        Animated.sequence([
          Animated.delay(250 + delayBase + i * 110 + 160),
          Animated.spring(l, { toValue: 1, stiffness: 150, damping: 7.5, mass: 1, useNativeDriver: false }),
        ]),
      ),
    );
    landing.start();
    return () => landing.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion]);

  // ---- pulling the rope -------------------------------------------------------------------
  const grab = useRef({ on: false, x: 0, y: 0 });
  const live = useRef({ ropeY, x0, x1, height, motion, sag, board });
  live.current = { ropeY, x0, x1, height, motion, sag, board };
  /** where the rope is at x right now (px from the top of this row) */
  const ropeAt = (x: number) => {
    const pull = store.pullF ? { x: store.pullX, f: store.pullF } : undefined;
    return live.current.ropeY + geo.current.cable.dipAt(x, store.now, pull);
  };
  const near = (x: number, y: number) => Math.abs(y - ropeAt(x)) < GRAB_PX;
  const nearRef = useRef(near);
  nearRef.current = near;
  /** bend the rope so it passes through (x, y), as if a hand held it there */
  const holdAt = (x: number, y: number) => {
    const { cable: c } = geo.current;
    const base = live.current.ropeY + c.dipAt(x, store.now);
    store.moveHand(x);
    store.pull.setValue((y - base) / Math.max(c.influence(x, x), 1e-6));
  };
  const holdRef = useRef(holdAt);
  holdRef.current = holdAt;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => nearRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { x0: a, x1: b } = live.current;
          store.pull.stopAnimation();
          const x = Math.max(a + 12, Math.min(b - 12, e.nativeEvent.locationX));
          const y = ropeAtRef.current(x); // take hold of the rope where it is (no jump)
          grab.current = { on: true, x, y };
          holdRef.current(x, y);
          haptic.pick();
          playSfx('pickup');
        },
        onPanResponderMove: (_e, g) => {
          const { x0: a, x1: b, ropeY: top, height: h, sag: dip, board: big } = live.current;
          const x = Math.max(a + 12, Math.min(b - 12, grab.current.x + g.dx));
          // how far the rope can be lifted or pulled down (less on phones, where the row clips)
          const lo = top - (big ? 70 : 30);
          const hi = big ? h - 10 : top + dip + 40;
          const y = Math.max(lo, Math.min(hi, grab.current.y + g.dy));
          holdRef.current(x, y);
        },
        onPanResponderRelease: (_e, g) => let_go(g.vy),
        onPanResponderTerminate: () => let_go(0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  );
  const ropeAtRef = useRef(ropeAt);
  ropeAtRef.current = ropeAt;
  /** let go: the rope springs back and bounces (keeping the speed it was thrown with) */
  function let_go(vy: number) {
    if (!grab.current.on) return;
    grab.current.on = false;
    const { cable: c } = geo.current;
    const perPx = Math.max(c.influence(store.pullX, store.pullX), 1e-6);
    const velocity = (vy * 1000) / perPx; // px/ms → pull units per second
    if (live.current.motion) Animated.spring(store.pull, { toValue: 0, velocity, stiffness: 120, damping: 4.2, mass: 1, useNativeDriver: false }).start();
    else Animated.timing(store.pull, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    playSfx('drop');
  }

  // web: show a grab hand over the rope, and keep the page from scrolling when a finger takes it
  const band = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!IS_WEB) return;
    const el = band.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const local = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return [cx - r.left, cy - r.top] as const;
    };
    const hover = (ev: PointerEvent) => {
      const [x, y] = local(ev.clientX, ev.clientY);
      el.style.cursor = grab.current.on ? 'grabbing' : nearRef.current(x, y) ? 'grab' : '';
    };
    const touch = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      const [x, y] = local(t.clientX, t.clientY);
      if (nearRef.current(x, y)) ev.preventDefault(); // no page scroll while holding the rope
    };
    const press = (ev: MouseEvent) => {
      const [x, y] = local(ev.clientX, ev.clientY);
      if (nearRef.current(x, y)) ev.preventDefault(); // no text selection while pulling with a mouse
    };
    el.addEventListener('pointermove', hover);
    el.addEventListener('touchstart', touch, { passive: false });
    el.addEventListener('mousedown', press);
    return () => {
      el.removeEventListener('pointermove', hover);
      el.removeEventListener('touchstart', touch);
      el.removeEventListener('mousedown', press);
    };
  }, [width > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /** a tap on a card jolts the cable at that card, and the whole line bounces */
  const press = useMemo(
    () =>
      items.map((it, i) => () => {
        if (motion) {
          Animated.sequence([
            Animated.timing(store.loads[i], { toValue: 1.5, duration: 90, useNativeDriver: false }),
            Animated.spring(store.loads[i], { toValue: 1, stiffness: 150, damping: 6, mass: 1, useNativeDriver: false }),
          ]).start();
        }
        onPick(it.key);
      }),
    [items, onPick, motion, store],
  );

  // ---- draw this frame --------------------------------------------------------------------
  const pullNow = store.pullF ? { x: store.pullX, f: store.pullF } : undefined;
  const rope = <Rope d={cable.path(ropeY, store.now, pullNow)} width={contentW} height={height} />;
  const grabBand = <View ref={band} style={StyleSheet.absoluteFill} {...responder.panHandlers} />;

  const cards =
    width > 0 &&
    items.map((it, i) => {
      const cx = cxs[i];
      const clipY = ropeY + cable.dipAt(cx, rest);
      const ride = cable.dipAt(cx, store.now, pullNow) - cable.dipAt(cx, rest);
      // cards hang plumb from their pegs, with a hint of the cable's slope and a playful lean
      const tilt = ((Math.atan(cable.slopes[i]) * 180) / Math.PI) * 0.35 + (i % 2 ? 1.8 : -1.8);
      // swing around the peg (transforms pivot on the layer's centre, so measure from there)
      const px = cx - contentW / 2;
      const py = clipY - height / 2;
      return (
        <View
          key={it.key}
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: px },
                { translateY: py + ride },
                { rotate: `${sim.current.th[i].toFixed(2)}deg` },
                { translateX: -px },
                { translateY: -py },
              ],
            },
          ]}
        >
          <HangingCard
            item={it}
            x={cx - cardW / 2}
            clipY={clipY}
            w={cardW}
            h={cardH}
            artH={cardW * artRatio}
            tilt={tilt}
            index={i}
            delayBase={delayBase}
            onPress={press[i]}
            s={s}
          />
        </View>
      );
    });

  if (board) {
    return (
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && rope}
        {grabBand}
        {cards}
      </View>
    );
  }
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: contentW, height }}>
        {width > 0 && rope}
        {grabBand}
        {cards}
      </ScrollView>
      {showSwipe && <Text style={styles.swipe}>Swipe for more games →</Text>}
    </View>
  );
}

/** how close (px) a finger or mouse must be to the rope to take hold of it */
const GRAB_PX = 24;
/** the most a peg lets a card twist while the rope is pulled (degrees) */
const MAX_TILT = 22;
/** card swing: stiffness and damping of the peg (a low damping ratio, so they shake a few times) */
const SWING_K = 170;
const SWING_C = 4.4;

type Store = {
  loads: Animated.Value[];
  now: number[];
  pull: Animated.Value;
  pullF: number;
  pullX: number;
  subs: Set<() => void>;
  /** where along the rope the hand is (px) */
  moveHand: (x: number) => void;
};

/** Animated values plus a plain copy of their current numbers, kept in sync from creation. */
function makeStore(n: number, start: number): Store {
  const subs = new Set<() => void>();
  const store: Store = {
    loads: [],
    now: Array.from({ length: n }, () => start),
    pull: new Animated.Value(0),
    pullF: 0,
    pullX: 0,
    subs,
    moveHand: (x) => {
      store.pullX = x;
    },
  };
  store.loads = store.now.map((v, i) => {
    const av = new Animated.Value(v);
    av.addListener(({ value }) => {
      store.now[i] = value;
      subs.forEach((f) => f());
    });
    return av;
  });
  store.pull.addListener(({ value }) => {
    store.pullF = Math.abs(value) < 1e-4 ? 0 : value;
    subs.forEach((f) => f());
  });
  return store;
}

/** The cable itself: a twisted jute rope with a soft shadow. */
const Rope = memo(function Rope({ d, width, height }: { d: string; width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G transform="translate(0 3.5)">
        <Path d={d} stroke="rgba(28, 40, 90, 0.16)" strokeWidth={5} fill="none" strokeLinecap="round" />
      </G>
      <Path d={d} stroke="#8A6643" strokeWidth={3.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke="#B48A5C" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* twisted strands */}
      <G transform="translate(0 -0.6)">
        <Path d={d} stroke="#EBCFA2" strokeWidth={1.2} strokeDasharray="2.4 3.2" fill="none" />
      </G>
    </Svg>
  );
});

const HangingCard = memo(function HangingCard({
  item,
  x,
  clipY,
  w,
  h,
  artH,
  tilt,
  index,
  delayBase,
  onPress,
  s,
}: {
  item: HangingItem;
  x: number;
  clipY: number;
  w: number;
  h: number;
  artH: number;
  tilt: number;
  index: number;
  delayBase: number;
  onPress: () => void;
  s: (n: number) => number;
}) {
  const motion = useMotion();
  // ~0.58em per character in the display font; inner width = card minus padding
  const titleSize = Math.max(s(13), Math.min(s(19), (w - s(20) - 8) / (item.title.length * 0.58)));
  // Entrance drop/swing and the tap "kick" are short one-off animations; the endless idle sway is
  // a GPU loop (Looping), so it costs nothing while the page sits open.
  const angle = useRef(new Animated.Value(motion ? tilt + (index % 2 ? -14 : 14) : tilt)).current;
  const drop = useRef(new Animated.Value(motion ? -70 : 0)).current;

  useEffect(() => {
    if (!motion) {
      angle.setValue(tilt);
      drop.setValue(0);
      return;
    }
    const entrance = Animated.sequence([
      Animated.delay(250 + delayBase + index * 110),
      Animated.parallel([
        Animated.spring(drop, { toValue: 0, friction: 6, tension: 70, useNativeDriver: NATIVE }),
        Animated.spring(angle, { toValue: tilt, friction: 2.2, tension: 26, useNativeDriver: NATIVE }),
      ]),
    ]);
    entrance.start();
    return () => entrance.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, tilt]);

  const kick = () => {
    if (motion) {
      Animated.sequence([
        Animated.timing(angle, { toValue: tilt + (index % 2 ? -9 : 9), duration: 110, useNativeDriver: NATIVE }),
        Animated.spring(angle, { toValue: tilt, friction: 2.6, tension: 40, useNativeDriver: NATIVE }),
      ]).start();
    }
    onPress();
  };

  const pivot = h / 2 + 12; // the clip sits 12px above the card
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: clipY + 12,
        width: w,
        height: h,
        transform: [
          { translateY: drop },
          { translateY: -pivot },
          { rotate: angle.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }) },
          { translateY: pivot },
        ],
      }}
    >
      <Looping
        on={motion}
        style={StyleSheet.absoluteFill}
        from={{ transform: [{ translateY: -pivot }, { rotate: '-2deg' }, { translateY: pivot }] }}
        to={{ transform: [{ translateY: -pivot }, { rotate: '2deg' }, { translateY: pivot }] }}
        duration={1900 + index * 160}
        phase={(index * 0.37) % 1}
        smooth
        alternate
      >
      {/* clothes-peg clip */}
      <View style={[styles.clipWrap, { left: w / 2 - 9, top: -24 }]} pointerEvents="none">
        <Svg width={18} height={34} viewBox="0 0 18 34">
          <Rect x={1} y={4} width={16} height={28} rx={4} fill={item.clipDark} />
          <Rect x={1} y={1} width={16} height={28} rx={4} fill={item.clip} />
          <Rect x={7} y={6} width={4} height={12} rx={2} fill="rgba(255,255,255,0.55)" />
        </Svg>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        onPress={kick}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.card,
          { borderRadius: s(18), padding: s(10) },
          (hovered || pressed) && { transform: [{ scale: pressed ? 0.98 : 1.04 }] },
        ]}
      >
        <View style={[styles.art, { backgroundColor: item.tint, borderRadius: s(12), height: artH }]}>{item.art}</View>
        <View style={{ paddingHorizontal: 4, paddingTop: s(8), gap: 2, flex: 1 }}>
          {/* shrink long titles ("Name the Country") on narrow phone cards so they never cut off */}
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.2 }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.subtitle, { fontSize: s(12.5) }]} numberOfLines={h / w < 1.1 ? 1 : 2}>
            {item.subtitle}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
            {[0, 1, 2].map((k) => (
              <StarIcon key={k} size={s(14)} filled={k < item.stars} />
            ))}
            {item.note ? <Text style={[styles.note, { fontSize: s(11) }]}>{item.note}</Text> : null}
          </View>
        </View>
      </Pressable>
      </Looping>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  clipWrap: { position: 'absolute', zIndex: 2 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F5C',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EFEAFB',
  },
  art: { overflow: 'hidden', padding: 6 },
  title: { fontFamily: fonts.display, color: colors.ink },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 16 },
  note: { fontFamily: fonts.bodyBold, color: colors.inkSoft, marginLeft: 4 },
  swipe: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12, textAlign: 'center', marginTop: 2 },
});
