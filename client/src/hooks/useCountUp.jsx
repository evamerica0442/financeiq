import { useState, useEffect, useRef } from 'react';

export default function useCountUp(end, duration = 800, startOnMount = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(startOnMount);
  const observerRef = useRef(null);
  const countRef = useRef(0);

  useEffect(() => {
    if (!started) return;
    if (end === 0) {
      setCount(0);
      return;
    }

    let startTime = null;
    const startValue = countRef.current;
    const endValue = Number(end);
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = startValue + (endValue - startValue) * eased;
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration, started]);

  function start() {
    countRef.current = 0;
    setCount(0);
    setStarted(true);
  }

  function observe(ref) {
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
  }

  return { count: Math.round(count * 100) / 100, start, observe };
}