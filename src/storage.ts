import type { Career } from './engine';

const SAVE_KEY = 'copero-baseball:career:v1';
export const isTossBuild = import.meta.env.MODE === 'toss';
export const loadSdk = () => import('@apps-in-toss/web-framework');

function withDeadline<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('저장소 응답 시간이 초과됐어요.')), 6000);
    void request.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error: unknown) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

let keyRequest: Promise<string> | undefined;
function getNativeKey(): Promise<string> {
  return keyRequest ??= (async () => {
    const { getUserKeyForGame } = await loadSdk();
    if (!getUserKeyForGame.isSupported()) throw new Error('현재 환경에서는 게임을 실행할 수 없어요.');
    const owner = await getUserKeyForGame();
    if (!owner || owner === 'ERROR' || owner.type !== 'HASH' || !owner.hash) {
      throw new Error('게임 사용자 정보를 확인하지 못했어요.');
    }
    return `${SAVE_KEY}:${owner.hash}`;
  })().catch((error: unknown) => { keyRequest = undefined; throw error; });
}

export async function loadCareer(): Promise<Career | null> {
  let raw: string | null;
  if (isTossBuild) {
    const [sdk, key] = await withDeadline(Promise.all([loadSdk(), getNativeKey()]));
    raw = await withDeadline(sdk.Storage.getItem(key));
  } else {
    raw = window.localStorage.getItem(SAVE_KEY);
  }
  if (raw === null) return null;
  const saved = JSON.parse(raw) as { version?: number; career?: Career | null };
  if (saved.version !== 1 || saved.career === undefined || (saved.career !== null && (
    typeof saved.career.name !== 'string' || !Array.isArray(saved.career.seasons) ||
    !Array.isArray(saved.career.offers) || !['draft', 'prepare', 'moment', 'offseason', 'retired'].includes(saved.career.phase)
  ))) throw new Error('저장된 선수 기록을 읽을 수 없어요.');
  return saved.career;
}

let nativeWrite: { payload: string; request: Promise<void> } | undefined;
export async function saveCareer(career: Career | null): Promise<void> {
  const payload = JSON.stringify({ version: 1, career });
  if (!isTossBuild) {
    window.localStorage.setItem(SAVE_KEY, payload);
    return;
  }
  const [sdk, key] = await withDeadline(Promise.all([loadSdk(), getNativeKey()]));
  if (nativeWrite && nativeWrite.payload !== payload) await withDeadline(nativeWrite.request);
  nativeWrite ??= {
    payload,
    request: sdk.Storage.setItem(key, payload).finally(() => { nativeWrite = undefined; }),
  };
  await withDeadline(nativeWrite.request);
}
