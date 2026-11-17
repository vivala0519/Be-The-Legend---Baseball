import { useEffect, useRef, useState } from 'react';
import { isTossBuild, loadSdk } from './storage';
import './native-controls.css';

export function NativeControls() {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isTossBuild) return;
    let stopped = false;
    const cleanup: (() => void)[] = [];
    void loadSdk().then(({ SafeArea, graniteEvent }) => {
      if (stopped) return;
      const applyInsets = (insets: ReturnType<typeof SafeArea.get>) => {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
          const inset = insets?.[side];
          if (Number.isFinite(inset)) document.documentElement.style.setProperty(`--sdk-safe-${side}`, `${inset}px`);
        }
      };
      applyInsets(SafeArea.get());
      cleanup.push(SafeArea.subscribe({ onEvent: applyInsets }));
      cleanup.push(graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (closing.current) return;
          const gameDialog = document.querySelector<HTMLDialogElement>('.confirm-dialog[open]');
          if (gameDialog) {
            if (gameDialog.dispatchEvent(new Event('cancel', { cancelable: true }))) gameDialog.close();
            return;
          }
          if (!window.dispatchEvent(new Event('career-back', { cancelable: true }))) return;
          const current = dialog.current;
          if (current?.open) current.close();
          else {
            setError(false);
            current?.showModal();
          }
        },
        onError: () => {},
      }));
    }).catch(() => {});
    return () => {
      stopped = true;
      for (const unsubscribe of cleanup) unsubscribe();
    };
  }, []);

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    setError(false);
    try {
      const { Screen } = await loadSdk();
      await Screen.close();
      dialog.current?.close();
    } catch {
      setError(true);
    } finally {
      closing.current = false;
    }
  };

  if (!isTossBuild) return null;
  return (
    <dialog className="native-exit" ref={dialog} aria-labelledby="exit-title">
      <h2 id="exit-title">게임을 나갈까요?</h2>
      <p>저장된 선수 기록은 다음에 이어서 볼 수 있어요.</p>
      {error && <p role="alert">게임을 닫지 못했어요. 다시 시도해 주세요.</p>}
      <div className="native-exit-actions">
        <button type="button" onClick={() => dialog.current?.close()}>계속하기</button>
        <button type="button" onClick={() => void close()}>게임 종료</button>
      </div>
    </dialog>
  );
}
