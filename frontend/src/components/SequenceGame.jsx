import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

const ARROW_ICONS = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

export default function SequenceGame({ sequence, duration, arrowTime = 2, maxErrors = 3, onComplete, onFail }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [arrowGeneration, setArrowGeneration] = useState(0);
  const [buttonFlash, setButtonFlash] = useState(null);
  const [arrowFlash, setArrowFlash] = useState(null);
  const [shaking, setShaking] = useState(false);
  const [arrowTimeLeft, setArrowTimeLeft] = useState(arrowTime);
  const [mainTimeLeft, setMainTimeLeft] = useState(duration);

  const inAnimation = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  // Main countdown — fires onComplete when done
  useEffect(() => {
    const endAt = Date.now() + duration * 1000;
    const tick = setInterval(() => {
      const remaining = Math.max(0, (endAt - Date.now()) / 1000);
      setMainTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        onCompleteRef.current?.();
      }
    }, 100);
    return () => clearInterval(tick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-arrow countdown — timeout = instant fail
  useEffect(() => {
    setArrowTimeLeft(arrowTime);
    const startTime = Date.now();

    const tick = setInterval(() => {
      const remaining = Math.max(0, arrowTime - (Date.now() - startTime) / 1000);
      setArrowTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(tick);
        if (inAnimation.current) return;
        inAnimation.current = true;
        setArrowFlash('wrong');
        setShaking(true);
        setTimeout(() => {
          inAnimation.current = false;
          onFailRef.current?.();
        }, 300);
      }
    }, 100);

    return () => clearInterval(tick);
  }, [arrowGeneration, arrowTime]);

  const handleTap = useCallback(
    (tappedDirection) => {
      if (inAnimation.current) return;

      const expected = sequence[stepIndex % sequence.length];

      if (tappedDirection === expected) {
        inAnimation.current = true;
        setButtonFlash({ dir: tappedDirection, type: 'correct' });
        setArrowFlash('correct');

        setTimeout(() => {
          inAnimation.current = false;
          setButtonFlash(null);
          setArrowFlash(null);
          setStepIndex((i) => (i + 1) % sequence.length);
          setArrowGeneration((g) => g + 1);
        }, 200);
      } else {
        const newErrors = errors + 1;
        setErrors(newErrors);
        inAnimation.current = true;
        setButtonFlash({ dir: tappedDirection, type: 'wrong' });
        setArrowFlash('wrong');
        setShaking(true);

        if (newErrors >= maxErrors) {
          setTimeout(() => {
            inAnimation.current = false;
            onFailRef.current?.();
          }, 400);
        } else {
          setTimeout(() => {
            inAnimation.current = false;
            setStepIndex(0);
            setButtonFlash(null);
            setArrowFlash(null);
            setShaking(false);
            setArrowGeneration((g) => g + 1);
          }, 300);
        }
      }
    },
    [stepIndex, sequence, maxErrors, errors],
  );

  const CurrentIcon = ARROW_ICONS[sequence[stepIndex % sequence.length]];

  const arrowTimerPercent = (arrowTimeLeft / arrowTime) * 100;
  const arrowTimerColor =
    arrowTimeLeft < 0.5 ? '#ef4444' : arrowTimeLeft < 1 ? '#f97316' : '#4ade80';

  const mainTimerPercent = (mainTimeLeft / duration) * 100;
  const mainTimerColor =
    mainTimeLeft < duration * 0.25
      ? '#ef4444'
      : mainTimeLeft < duration * 0.5
        ? '#f97316'
        : '#4ade80';

  const arrowColor =
    arrowFlash === 'correct' ? '#4ade80' : arrowFlash === 'wrong' ? '#ef4444' : '#f97316';

  const mainTotalSecs = Math.ceil(mainTimeLeft);
  const mainMM = String(Math.floor(mainTotalSecs / 60)).padStart(2, '0');
  const mainSS = String(mainTotalSecs % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto select-none">
      {/* Main timer */}
      <div className="font-mono font-bold text-4xl" style={{ color: mainTimerColor }}>
        {mainMM}:{mainSS}
      </div>
      <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#d1d5db' }}>
        <div
          className="h-3 rounded-full"
          style={{ width: `${mainTimerPercent}%`, backgroundColor: mainTimerColor, transition: 'background-color 0.3s' }}
        />
      </div>

      {/* Strike indicators */}
      <div className="flex gap-2">
        {Array.from({ length: maxErrors }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: i < errors ? '#ef4444' : '#d1d5db' }}
          />
        ))}
      </div>

      {/* Current arrow icon */}
      <div className={shaking ? 'shake' : ''} style={{ color: arrowColor, transition: 'color 0.15s' }}>
        <CurrentIcon style={{ width: 120, height: 120 }} strokeWidth={2.5} />
      </div>

      {/* Per-arrow timer bar */}
      <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#d1d5db' }}>
        <div
          className="h-2 rounded-full"
          style={{ width: `${arrowTimerPercent}%`, backgroundColor: arrowTimerColor, transition: 'background-color 0.3s' }}
        />
      </div>

      {/* Arrow buttons */}
      <div className="flex flex-col gap-3 w-full">
        <div className="flex justify-center">
          <ArrowButton dir="up" flash={buttonFlash?.dir === 'up' ? buttonFlash.type : null} onTap={handleTap} />
        </div>
        <div className="flex gap-3 justify-center">
          <ArrowButton dir="left" flash={buttonFlash?.dir === 'left' ? buttonFlash.type : null} onTap={handleTap} />
          <ArrowButton dir="right" flash={buttonFlash?.dir === 'right' ? buttonFlash.type : null} onTap={handleTap} />
        </div>
        <div className="flex justify-center">
          <ArrowButton dir="down" flash={buttonFlash?.dir === 'down' ? buttonFlash.type : null} onTap={handleTap} />
        </div>
      </div>
    </div>
  );
}

function ArrowButton({ dir, flash, onTap }) {
  const Icon = ARROW_ICONS[dir];
  const bg = flash === 'correct' ? '#166534' : flash === 'wrong' ? '#7f1d1d' : '#fff';
  const border = flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#ef4444' : '#1A3468';
  const color = flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#ef4444' : '#1A3468';

  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onTap(dir); }}
      style={{
        width: 100,
        height: 100,
        backgroundColor: bg,
        border: `2px solid ${border}`,
        color,
        transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <Icon style={{ width: 48, height: 48 }} strokeWidth={2.5} />
    </button>
  );
}
