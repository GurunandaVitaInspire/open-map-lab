import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMotion } from '../../lib/motion';
import { SEA_POSTER, SEA_VIDEO } from './seaAssets';

/**
 * Real ocean footage behind the bottom of the landing page (web).
 * - nothing is downloaded until the page itself has finished loading
 * - muted + playsInline so browsers allow it to autoplay; it pauses when off screen, when the tab
 *   is hidden and when motion is paused, so it never costs anything while you play
 * - the still poster frame shows until the video is ready (and stays when motion is paused)
 */
export function RealSea({ height, children }: { height: number; children?: ReactNode }) {
  const motion = useMotion();
  const box = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  // the clip is small (~300 KB): fetch it once the page itself has finished loading
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const go = () => (t = setTimeout(() => setNear(true), 400));
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('load', go);
    };
  }, []);

  // pause while scrolled out of view
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // play only while it can be seen and motion is on
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = () => {
      if (motion && visible && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [motion, visible, near]);

  return (
    <View
      ref={(r) => {
        box.current = r as unknown as HTMLElement | null;
      }}
      style={[styles.box, { height, backgroundImage: `url(${SEA_POSTER})` } as object]}
    >
      {near && (
        <video
          ref={video}
          muted
          loop
          playsInline
          autoPlay={motion}
          preload="auto"
          poster={SEA_POSTER}
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          onCanPlay={() => setReady(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: ready ? 1 : 0,
            transition: 'opacity 900ms ease',
            pointerEvents: 'none',
          }}
        >
          {SEA_VIDEO.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'relative', overflow: 'hidden', backgroundSize: 'cover', backgroundPosition: 'center' } as object,
});
