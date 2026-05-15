import { useState, useEffect } from 'react';

export default function BombTimer({ explodeAt }) {
  const [remainingMilliseconds, setRemainingMilliseconds] = useState(null);

  useEffect(() => {
    if (!explodeAt) return;

    function updateCountdown() {
      const millisecondsDiff = Math.max(0, new Date(explodeAt).getTime() - Date.now());
      setRemainingMilliseconds(millisecondsDiff);
    }

    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 100);
    return () => clearInterval(countdownInterval);
  }, [explodeAt]);

  if (!explodeAt || remainingMilliseconds === null) return null;

  const totalSeconds = Math.ceil(remainingMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = totalSeconds < 10;
  const isDead = totalSeconds <= 0;

  return (
    <div className={`text-center font-mono font-bold ${isUrgent ? 'pulse-red' : ''}`}>
      <div
        className="text-6xl"
        style={{ color: isDead ? '#ef4444' : isUrgent ? '#ef4444' : '#f97316' }}
      >
        {isDead ? '00:00' : displayTime}
      </div>
      {isUrgent && !isDead && (
        <div className="text-red-500 text-sm tracking-widest mt-1 uppercase">CRITICAL</div>
      )}
    </div>
  );
}
