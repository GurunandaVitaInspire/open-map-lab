import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { View as MapView } from '../data/maps';

/**
 * Tracks where a map (drawn centred inside a container) sits on screen, so games can convert
 * between touch positions, map units and overlay coordinates.
 */
export function useMapFrame(view: MapView) {
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const mapRef = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState({ w: 0, h: 0 }); // map container size
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });
  const origin = useRef({ root: { x: 0, y: 0 }, svg: { x: 0, y: 0 } });

  const scale = box.w > 0 ? Math.min(box.w / view.w, box.h / view.h) : 0;
  /** offset of the map svg inside its container */
  const inset = { left: (box.w - view.w * scale) / 2, top: (box.h - view.h * scale) / 2 };

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => (origin.current.root = { x, y }));
    mapRef.current?.measureInWindow((x, y, w, h) => {
      const sc = Math.min(w / view.w, h / view.h);
      origin.current.svg = { x: x + (w - view.w * sc) / 2, y: y + (h - view.h * sc) / 2 };
    });
  }, [view]);

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    requestAnimationFrame(measure);
  };
  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setRootSize({ w: width, h: height });
    requestAnimationFrame(measure);
  };

  /** map units → position inside the root view (for overlays like celebrations) */
  const toRoot = (mx: number, my: number) => {
    const { svg, root } = origin.current;
    return { x: svg.x - root.x + (mx - view.x) * scale, y: svg.y - root.y + (my - view.y) * scale };
  };
  /** page (touch) position → map units */
  const pageToMap = (px: number, py: number) => {
    const { svg } = origin.current;
    return { x: view.x + (px - svg.x) / scale, y: view.y + (py - svg.y) / scale };
  };
  const inMap = (mx: number, my: number) => mx >= view.x && my >= view.y && mx <= view.x + view.w && my <= view.y + view.h;

  return { rootRef, mapRef, scale, inset, rootSize, origin, measure, onMapLayout, onRootLayout, toRoot, pageToMap, inMap };
}
