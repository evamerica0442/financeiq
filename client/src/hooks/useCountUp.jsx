
import { useState, useEffect, useRef, useCallback } from 'react';

export default function useCountUp(end, duration = 800, startOnMount = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(startOnMount);
  const [tick, setTick] = useState(0); // increment to force re-animation
  const observerRef = useRef(null);

  useEffect(() => {
    if (!started) return;
    if (end === 0) {
      setCount(0);
      return;
    }

    let startTime = null;
    const startValue = 0;
    const endValue = Number(end);
    let frameId;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = startValue + (endValue - startValue) * eased;
      setCount(current);
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [end, duration, started, tick]);

  const start = useCallback(() => {
    setCount(0);
    setStarted(true);
    setTick(t => t + 1); // force effect to re-run
  }, []);

  const observe = useCallback((ref) => {
    if (observerRef.current) observerRef.current.disconnect();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref) {
      observer.observe(ref);
      observerRef.current = observer;
    }
  }, [start]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return { count: Math.round(count * 100) / 100, start, observe };
}