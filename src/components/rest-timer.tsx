"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Rest timer shown above the bottom nav. Stores the end time (not a running
// count) in localStorage, so it stays right after a reload or while the
// phone was locked.

const STORAGE_KEY = "rest-timer";
const DONE_BANNER_MS = 4000;

interface TimerState {
  endsAt: number;
  totalSeconds: number;
}

interface RestTimerApi {
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  skip: () => void;
}

const RestTimerContext = createContext<RestTimerApi>({ start() {}, adjust() {}, skip() {} });

export function useRestTimer() {
  return useContext(RestTimerContext);
}

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as TimerState) : null;
    return state && state.endsAt > Date.now() ? state : null;
  } catch {
    return null;
  }
}

function save(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the timer still works for this page view.
  }
}

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  // Mounted only on the client (the app layout shows a splash first), so
  // reading localStorage during the first render is safe.
  const [timer, setTimer] = useState<TimerState | null>(load);
  const [now, setNow] = useState(() => Date.now());
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const update = useCallback((next: TimerState | null) => {
    setTimer(next);
    save(next);
  }, []);

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      // Created inside the tap handler so mobile browsers allow sound later.
      audio.current ??= typeof AudioContext !== "undefined" ? new AudioContext() : null;
      void audio.current?.resume();
      setDoneAt(null);
      setNow(Date.now());
      update({ endsAt: Date.now() + seconds * 1000, totalSeconds: seconds });
    },
    [update],
  );

  const adjust = useCallback(
    (delta: number) => {
      if (!timer) return;
      const endsAt = timer.endsAt + delta * 1000;
      if (endsAt <= Date.now()) update(null);
      else update({ endsAt, totalSeconds: Math.max(1, timer.totalSeconds + delta) });
    },
    [timer, update],
  );

  const skip = useCallback(() => update(null), [update]);

  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= timer.endsAt) {
        update(null);
        setDoneAt(t);
        alertDone(audio.current);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timer, update]);

  useEffect(() => {
    if (!doneAt) return;
    const id = setTimeout(() => setDoneAt(null), DONE_BANNER_MS);
    return () => clearTimeout(id);
  }, [doneAt]);

  const remaining = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0;

  return (
    <RestTimerContext.Provider value={{ start, adjust, skip }}>
      {children}
      {(timer || doneAt) && (
        <div
          role="timer"
          aria-label="Descanso"
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-10 px-3"
        >
          <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl bg-surface-2 shadow-lg shadow-black/40">
            {timer ? (
              <>
                <div
                  className="absolute inset-y-0 left-0 bg-accent/15 transition-[width] duration-300"
                  style={{ width: `${(remaining / timer.totalSeconds) * 100}%` }}
                />
                <div className="relative flex items-center gap-2 px-3 py-2">
                  <TimerButton label="Menos 15 segundos" onClick={() => adjust(-15)}>
                    −15
                  </TimerButton>
                  <p className="flex-1 text-center">
                    <span className="block text-xs text-muted">Descanso</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                    </span>
                  </p>
                  <TimerButton label="Mais 15 segundos" onClick={() => adjust(15)}>
                    +15
                  </TimerButton>
                  <TimerButton label="Pular descanso" onClick={skip}>
                    Pular
                  </TimerButton>
                </div>
              </>
            ) : (
              <p className="py-4 text-center font-semibold text-accent">Descanso concluído. Bora!</p>
            )}
          </div>
        </div>
      )}
    </RestTimerContext.Provider>
  );
}

function TimerButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="h-10 min-w-12 rounded-xl bg-background/60 px-2 text-sm font-semibold"
    >
      {children}
    </button>
  );
}

function alertDone(ctx: AudioContext | null) {
  navigator.vibrate?.([300, 150, 300]);
  if (!ctx || document.visibilityState !== "visible") return;
  // Three short beeps.
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.25;
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}
