// LiveCountdown — ticks down toward a target ISO timestamp every second.
// Used by OutOfHeartsModal to show the heart-refill timer counting down
// in real time (loss-aversion psychology: a moving clock creates urgency).
//
// Renders nothing once the target has passed. Caller is responsible for
// reacting to refill completion (e.g., refreshing context state) via a
// separate listener — this component is purely presentation.

import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

const ONE_SEC = 1000;

/**
 * @param {Object} props
 * @param {string|Date} props.target  ISO string or Date when the timer
 *   should hit zero (e.g., next heart refill timestamp).
 * @param {string}  [props.format='m:ss']  'm:ss' or 'mm' (minutes only).
 * @param {object}  [props.style]  text style passthrough.
 * @param {React.ReactNode} [props.children]  optional wrapper format —
 *   if provided, the formatted time is interpolated via {time} substitution.
 *   e.g. `<LiveCountdown target={t}>{'Refills in {time}'}</LiveCountdown>`.
 */
export default function LiveCountdown({
  target,
  format = 'm:ss',
  style,
  children,
}) {
  const [remainingMs, setRemainingMs] = useState(() => {
    const t = target instanceof Date ? target : new Date(target);
    return Math.max(0, t.getTime() - Date.now());
  });

  useEffect(() => {
    const t = target instanceof Date ? target : new Date(target);
    if (Number.isNaN(t.getTime())) {
      setRemainingMs(0);
      return undefined;
    }
    // Pin the interval to next-second boundary so the first tick feels
    // synchronized rather than offset by a fractional ms.
    let interval = null;
    const tick = () => {
      const diff = Math.max(0, t.getTime() - Date.now());
      setRemainingMs(diff);
      if (diff <= 0 && interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    tick();
    interval = setInterval(tick, ONE_SEC);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [target]);

  if (remainingMs <= 0) return null;

  const totalSec = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const formatted =
    format === 'mm'
      ? `${mins}`
      : `${mins}:${String(secs).padStart(2, '0')}`;

  if (typeof children === 'string') {
    return <Text style={style}>{children.replace('{time}', formatted)}</Text>;
  }
  return <Text style={style}>{formatted}</Text>;
}
