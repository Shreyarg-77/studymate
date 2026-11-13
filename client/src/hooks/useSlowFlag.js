import { useEffect, useState } from "react";

// True when something has been "active" for longer than `delay` milliseconds.
export default function useSlowFlag(active, delay = 5000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setSlow(true), delay);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active, delay]);

  return active && slow;
}
