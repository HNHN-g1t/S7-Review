import { useEffect, useState } from 'react';

export const MISSION_BANNER_INTERVAL_MS = 4000;

/** Mounted per run: restart / stage change cannot inherit an old timer or face. */
export function MissionBanner({ title, objective, training, running }: {
  title: string;
  objective: string;
  training: boolean;
  running: boolean;
}) {
  const [showObjective, setShowObjective] = useState(false);
  useEffect(() => {
    // Training never consumes the first four seconds of the actual mission.
    if (training) {
      setShowObjective(false);
      return;
    }
    if (!running) return;
    const timer = window.setInterval(() => setShowObjective(value => !value), MISSION_BANNER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [training, running]);
  const face = training ? 'training' : showObjective ? 'objective' : 'title';
  return <span className="wall-mission-theme" data-face={face} aria-live="off" aria-label={training ? '特訓中！' : `${title}。目標：${objective}`}>
    <span>{training ? '特訓中！' : showObjective ? objective : title}</span>
  </span>;
}
