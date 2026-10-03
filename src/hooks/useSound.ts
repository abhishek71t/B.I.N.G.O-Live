import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_SOUND = 'bingo_sound_enabled';
const STORAGE_KEY_VOLUME = 'bingo_sound_volume';
const STORAGE_KEY_VIBRATION = 'bingo_vibration_enabled';

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SOUND);
    return saved !== null ? saved === 'true' : true;
  });

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
    const parsed = saved !== null ? parseFloat(saved) : 0.75;
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.75;
  });

  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIBRATION);
    return saved !== null ? saved === 'true' : true;
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SOUND, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIBRATION, String(vibrationEnabled));
  }, [vibrationEnabled]);

  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const getContext = useCallback((): AudioContext | null => {
    if (!soundEnabled || volume <= 0.01) return null;
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, [soundEnabled, volume]);

  const vibrate = useCallback(
    (pattern: number | number[] = 15) => {
      if (!vibrationEnabled) return;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(pattern);
        }
      } catch {
        // Ignore on unsupported devices
      }
    },
    [vibrationEnabled]
  );

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = 'sine',
      delay = 0,
      gainScale = 0.25,
      endFreq?: number
    ) => {
      const ctx = getContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq) {
          osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        }

        const peakGain = Math.max(0.001, volume * gainScale);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch {
        // Ignore scheduling errors
      }
    },
    [getContext, volume]
  );

  const playClick = useCallback(() => {
    playTone(500, 0.05, 'sine', 0, 0.16, 300);
    vibrate(8);
  }, [playTone, vibrate]);

  const playMark = useCallback(() => {
    playTone(460, 0.08, 'sine', 0, 0.25, 700);
    playTone(700, 0.1, 'triangle', 0.03, 0.18, 850);
    vibrate(18);
  }, [playTone, vibrate]);

  const playTurnChange = useCallback(() => {
    playTone(523.25, 0.1, 'sine', 0, 0.2); // C5
    playTone(659.25, 0.15, 'triangle', 0.08, 0.24); // E5
    vibrate([15, 30, 20]);
  }, [playTone, vibrate]);

  const playTick = useCallback(
    (urgent = false) => {
      playTone(urgent ? 980 : 750, 0.05, 'sine', 0, urgent ? 0.22 : 0.15);
      if (urgent) vibrate(12);
    },
    [playTone, vibrate]
  );

  const playLineComplete = useCallback(
    (count = 1) => {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const totalNotes = Math.min(5, Math.max(3, count + 2));
      for (let i = 0; i < totalNotes; i++) {
        playTone(notes[i], 0.16, 'triangle', i * 0.06, 0.28);
      }
      vibrate([25, 35, 45]);
    },
    [playTone, vibrate]
  );

  const playWin = useCallback(() => {
    const melody = [
      { f: 523.25, d: 0.1, t: 0 },
      { f: 659.25, d: 0.1, t: 0.1 },
      { f: 783.99, d: 0.1, t: 0.2 },
      { f: 1046.5, d: 0.22, t: 0.32 },
      { f: 783.99, d: 0.1, t: 0.52 },
      { f: 1046.5, d: 0.4, t: 0.64 },
    ];
    melody.forEach((n) => {
      playTone(n.f, n.d, 'triangle', n.t, 0.3);
    });
    vibrate([50, 40, 50, 40, 100]);
  }, [playTone, vibrate]);

  const playLose = useCallback(() => {
    const notes = [
      { f: 392.0, d: 0.16, t: 0 },
      { f: 369.99, d: 0.16, t: 0.16 },
      { f: 349.23, d: 0.16, t: 0.32 },
      { f: 329.63, d: 0.38, t: 0.48, end: 293.66 },
    ];
    notes.forEach((n) => {
      playTone(n.f, n.d, 'sawtooth', n.t, 0.15, n.end);
    });
    vibrate([60, 50, 80]);
  }, [playTone, vibrate]);

  const playPlayerJoined = useCallback(() => {
    playTone(587.33, 0.09, 'sine', 0, 0.2);
    playTone(880.0, 0.14, 'triangle', 0.07, 0.22);
    vibrate(12);
  }, [playTone, vibrate]);

  return {
    soundEnabled,
    setSoundEnabled,
    toggleSound: () => setSoundEnabled((p) => !p),
    volume,
    setVolume,
    vibrationEnabled,
    setVibrationEnabled,
    toggleVibration: () => setVibrationEnabled((p) => !p),
    playClick,
    playMark,
    playTurnChange,
    playTick,
    playLineComplete,
    playWin,
    playLose,
    playPlayerJoined,
    vibrate,
  };
}
