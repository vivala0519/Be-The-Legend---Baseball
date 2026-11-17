import { useEffect, useRef, useState } from 'react';
import { CareerScreen, LeagueCatalog } from './copero-career';
import { CreateScreen, HomeScreen } from './copero-setup';
import {
  chooseClub,
  createCareer,
  getPosition,
  playPeriod,
  resolvePeriodMoment,
  retire,
  type Career,
  type CareerMode,
} from './engine';
import { isTossBuild, loadCareer, saveCareer } from './storage';
import { readTheme, saveTheme, type Theme } from './theme';

type Screen = 'home' | 'create' | 'game';
type SaveAction = { next: Career; animate?: boolean };
type Playback = {
  phase: 'closing' | 'recording' | 'opening';
  career: Career;
  recordingYear: number | null;
};

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

function Toolbar({ theme, onTheme, onHome, disabled }: {
  theme: Theme;
  onTheme: () => void;
  onHome?: () => void;
  disabled: boolean;
}) {
  const dark = theme === 'dark';
  return (
    <div className="theme-toolbar">
      {onHome && (
        <button type="button" className="theme-toggle" aria-label="홈으로" disabled={disabled} onClick={onHome}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
          </svg>
        </button>
      )}
      <button type="button" className="theme-toggle" aria-pressed={dark} aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} onClick={onTheme}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z" />}
        </svg>
      </button>
    </div>
  );
}

export default function App() {
  const [career, setCareer] = useState<Career | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<CareerMode>('normal');
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SaveAction | null>(null);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'restart' | 'retire' | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const locked = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const playbackController = useRef<AbortController | null>(null);
  const disabled = busy || pending !== null;

  useEffect(() => {
    let active = true;
    void loadCareer().then((saved) => {
      if (active) setCareer(saved);
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => () => playbackController.current?.abort(), []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [screen]);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
  }, [confirmation]);

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (screen === 'home') return;
      event.preventDefault();
      if (locked.current || pending) return;
      const previous = screen === 'create' && document.querySelector<HTMLButtonElement>('[data-setup-back]');
      if (previous) previous.click();
      else setScreen('home');
    };
    window.addEventListener('career-back', handleBack);
    return () => window.removeEventListener('career-back', handleBack);
  }, [screen, pending]);

  const commit = async (action: SaveAction) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const { next } = action;
    const before = career;
    const additions = before && action.animate ? next.seasons.slice(before.seasons.length) : [];
    const motion = Boolean(before && additions.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const controller = new AbortController();
    const { signal } = controller;
    playbackController.current = controller;
    try {
      if (motion && before) setPlayback({ phase: 'closing', career: before, recordingYear: null });
      await saveCareer(next);
      if (signal.aborted) return;
      setCareer(next);
      setPending(null);
      setConfirmation(null);
      setScreen('game');
    } catch {
      if (!signal.aborted) {
        setPending(action);
        setError('기록을 저장하지 못했어요. 다시 저장해 주세요.');
        setPlayback(null);
        setBusy(false);
        locked.current = false;
      }
      return;
    }

    if (motion && before) {
      await pause(300, signal);
      for (const row of additions) {
        if (signal.aborted) return;
        const careerToShow = { ...next, seasons: next.seasons.slice(0, row.year) };
        setPlayback({ phase: 'recording', career: careerToShow, recordingYear: row.year });
        await pause(560, signal);
      }
      if (signal.aborted) return;
      setPlayback({ phase: 'opening', career: next, recordingYear: null });
      await pause(360, signal);
    }
    if (signal.aborted) return;
    setPlayback(null);
    setBusy(false);
    locked.current = false;
  };

  const execute = (action: () => Career, animate = false) => {
    if (disabled || locked.current) return;
    try {
      const next = action();
      if (next !== career) void commit({ next, animate });
    } catch {
      setError('선택을 적용하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const showing = playback?.career ?? career;
  const onHome = () => {
    if (!disabled) {
      setError('');
      setScreen('home');
    }
  };

  return (
    <div className="app-shell canvas" data-platform={isTossBuild ? 'toss' : 'web'}>
      <main className="app-content">
        <Toolbar theme={theme} onTheme={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          saveTheme(next);
          setTheme(next);
        }} onHome={screen === 'home' ? undefined : onHome} disabled={disabled} />

        {error && (
          <div className="status-banner danger flow-tight" role="alert">
            <p>{error}</p>
            {pending && !confirmation && <button type="button" className="secondary" disabled={busy} onClick={() => void commit(pending)}>다시 저장하기</button>}
          </div>
        )}

        {loading || loadError ? (
          <section className="card flow" role={loadError ? 'alert' : 'status'}>
            <h2>{loading ? '선수 기록을 불러오고 있어요' : '선수 기록을 불러오지 못했어요'}</h2>
            {loadError && (
              <button className="secondary" type="button" onClick={() => {
                setLoadError(false);
                setLoading(true);
                setReload((count) => count + 1);
              }}>다시 불러오기</button>
            )}
          </section>
        ) : screen === 'create' ? (
          <CreateScreen
            mode={mode}
            disabled={disabled}
            onBack={onHome}
            onCreate={({ name, position, number, bats }) => execute(() =>
              createCareer(name, position, crypto.getRandomValues(new Uint32Array(1))[0], { mode, number, bats })
            )}
          />
        ) : screen === 'game' && showing ? (
          <CareerScreen
            career={showing}
            playback={playback?.phase ?? 'idle'}
            recordingYear={playback?.recordingYear ?? null}
            disabled={disabled}
            onClub={(clubId) => career && execute(() => playPeriod(chooseClub(career, clubId)), true)}
            onSeason={() => career && execute(() => playPeriod(career), true)}
            onMoment={(approach) => career && execute(() => resolvePeriodMoment(career, approach), true)}
            onRetire={() => setConfirmation('retire')}
            onReplay={() => career && execute(() => createCareer(
              career.name,
              getPosition(career),
              crypto.getRandomValues(new Uint32Array(1))[0],
              { mode: career.mode ?? 'long', number: career.number ?? 10, bats: career.bats },
            ))}
            onRestart={() => setScreen('create')}
          />
        ) : (
          <div className="flow">
            <HomeScreen career={career} mode={mode} theme={theme} onMode={setMode} disabled={disabled}
              onContinue={() => setScreen('game')}
              onStart={() => {
                if (career && career.phase !== 'retired') setConfirmation('restart');
                else setScreen('create');
              }}
            />
            <LeagueCatalog />
          </div>
        )}

        {confirmation && (
          <dialog ref={dialog} className="confirm-dialog baseball-dialog" aria-labelledby="baseball-confirm-title" onCancel={(event) => {
            event.preventDefault();
            if (!disabled) setConfirmation(null);
          }}>
            <div className="card flow">
              <h2 id="baseball-confirm-title">{confirmation === 'restart' ? '새 커리어를 시작할까요?' : '선수 생활을 마무리할까요?'}</h2>
              <p>{confirmation === 'restart' ? '새 선수를 등록하면 현재 커리어 기록이 바뀌어요.' : '지금까지의 커리어를 은퇴 기록으로 남겨요.'}</p>
              {error && <p className="status-banner danger" role="alert">{error}</p>}
              <div className="cta-dock split">
                <button type="button" className="secondary" disabled={disabled} onClick={() => setConfirmation(null)}>취소</button>
                <button type="button" className="primary" disabled={busy} onClick={() => {
                  if (pending) void commit(pending);
                  else if (confirmation === 'restart') {
                    setConfirmation(null);
                    setScreen('create');
                  } else if (career) execute(() => retire(career));
                }}>{pending ? '다시 저장하기' : confirmation === 'restart' ? '새 선수 만들기' : '은퇴하기'}</button>
              </div>
            </div>
          </dialog>
        )}
      </main>
    </div>
  );
}
