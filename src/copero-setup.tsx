import { useId, useState } from 'react';
import { clubs, type Club } from './clubs';
import { getPosition, positionLabels, type Career, type CareerMode, type PitcherRole, type PlayerPosition } from './engine';
import { ChevronRight } from './icons';
import { ParticleBall } from './ParticleBall';
import type { Theme } from './theme';

const modes: CareerMode[] = ['long', 'normal', 'express'];

export const modeLabels: Record<CareerMode, { title: string; badge: string; description: string }> = {
  long: {
    title: '집중 모드',
    badge: '1시즌 단위',
    description: '매 시즌 결과를 확인하고 다음 시즌을 결정합니다.',
  },
  normal: {
    title: '일반 모드',
    badge: '2시즌 단위',
    description: '한 번의 선택으로 최대 두 시즌을 진행합니다.',
  },
  express: {
    title: '고속 모드',
    badge: '3시즌 단위',
    description: '한 번의 선택으로 최대 세 시즌을 진행합니다.',
  },
};

type DetailedPosition = Exclude<PlayerPosition, 'infielder' | 'outfielder' | PitcherRole>;

const fieldPositions: readonly { id: DetailedPosition; x: string; y: string }[] = [
  { id: 'centerField', x: '50%', y: '13%' },
  { id: 'leftField', x: '20%', y: '30%' },
  { id: 'rightField', x: '80%', y: '30%' },
  { id: 'shortstop', x: '34%', y: '48%' },
  { id: 'secondBase', x: '66%', y: '48%' },
  { id: 'thirdBase', x: '23%', y: '66%' },
  { id: 'firstBase', x: '77%', y: '66%' },
  { id: 'catcher', x: '50%', y: '87%' },
];

const batsChoices = [
  { id: 'R', name: '우타' },
  { id: 'L', name: '좌타' },
  { id: 'S', name: '양타' },
] as const;

type Bats = (typeof batsChoices)[number]['id'];
type PlayerType = 'batter' | 'pitcher';
type BaseballProfile = { name: string; number: number } & (
  { position: DetailedPosition; bats: Bats } | { position: PitcherRole; bats?: never }
);
const playerTypes = [{ id: 'batter', label: '타자' }, { id: 'pitcher', label: '투수' }] as const;
const pitcherRoles: readonly PitcherRole[] = ['starter', 'reliever'];
const jerseyNumbers = Array.from({ length: 100 }, (_, index) => index);

function SavedClubBadge({ club }: { club: Club | undefined }) {
  return (
    <span className="club-badge" aria-hidden="true">
      <svg viewBox="0 0 64 72" fill="none">
        <path d="M5 6h54v31c0 15-15 23-27 29C20 60 5 52 5 37V6Z" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="2.5" />
        <path d="M13 16h38M18 49l14 8 14-8" stroke="currentColor" opacity=".45" />
        <text x="32" y="39" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700">{club?.league ?? 'KBO'}</text>
      </svg>
    </span>
  );
}

export function HomeScreen({ career, mode, theme, onMode, onStart, onContinue, disabled }: {
  career: Career | null;
  mode: CareerMode;
  theme: Theme;
  onMode: (mode: CareerMode) => void;
  onStart: () => void;
  onContinue: () => void;
  disabled: boolean;
}) {
  const retired = career?.phase === 'retired';
  const club = career && clubs.find(({ id }) => id === career.clubId);

  return (
    <div className="flow">
      <header className="hero-block">
        <div className="hero-particle-ball" aria-hidden="true"><ParticleBall theme={theme} /></div>
        <h1>Be The Legend!</h1>
        <p className="subtitle">KBO 신인에서 메이저리거까지.<br />결정적인 한 타석으로 기록을 쌓아보세요.</p>
      </header>

      <section className="card flow" aria-label="진행 모드 선택">
        <div className="row between">
          <strong>게임 진행 모드</strong>
          <span className="caption">{modeLabels[mode].badge}</span>
        </div>
        <div className="mode-grid" role="group" aria-label="모드 선택">
          {modes.map((item) => (
            <button type="button" key={item} aria-pressed={mode === item}
              className={mode === item ? 'mode-card selected' : 'mode-card'}
              onClick={() => onMode(item)} disabled={disabled}>
              <div className="row between">
                <strong>{modeLabels[item].title}</strong>
                <span className="pill">{modeLabels[item].badge}</span>
              </div>
              <p className="caption">{modeLabels[item].description}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="cta-dock flow">
        {career ? (
          <>
            <button type="button" className="primary" disabled={disabled} onClick={onContinue}>
              <span>{retired ? '최근 플레이 기록 보기' : '이어하기'}</span><ChevronRight size={18} />
            </button>
            <button type="button" className="secondary" disabled={disabled} onClick={onStart}>새 커리어 시작</button>
          </>
        ) : (
          <button type="button" className="primary career-start-button" disabled={disabled} onClick={onStart}>
            <span>커리어 시작하기</span><ChevronRight size={18} />
          </button>
        )}
      </div>

      {career && (
        <section className="card flow" aria-label="저장된 커리어">
          <div className="row between">
            <span className="pill">{retired ? '은퇴 완료' : `${career.age}세 진행 중`}</span>
            <span className="caption">{modeLabels[career.mode ?? 'long'].title}</span>
          </div>
          <div className="club-row">
            <SavedClubBadge club={club || undefined} />
            <div>
              <strong>{career.name} · #{career.number ?? 10} {positionLabels[getPosition(career)]}</strong>
              <p className="caption">
                대한민국 · {club?.name ?? '지명 대기'} · {retired ? '최고 OVR' : 'OVR'} {retired
                  ? Math.max(career.overall, ...career.seasons.map(({ overall }) => overall)) : career.overall}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function BaseballJersey({ name, number }: { name: string; number: number }) {
  const clipId = useId();
  const display = [...(name.trim() || '무명 선수')].slice(0, 12).join('').toUpperCase();
  const kitPath = 'M65 20l-32 13L8 69l27 19 14-15v101c29 11 59 11 88 0V73l14 15 27-19-25-36-32-13c-13 15-43 15-56 0Z';

  return (
    <div className="jersey-preview-wrap">
      <svg className="jersey-svg" viewBox="0 0 186 200" role="img" aria-label={`야구 유니폼 미리보기 · ${display} · ${number}번`}>
        <defs><clipPath id={clipId}><path d={kitPath} /></clipPath></defs>
        <path d={kitPath} fill="#f4f5f7" stroke="#bdc8dd" strokeWidth="2" />
        <g clipPath={`url(#${clipId})`}>
          <path d="M43 18v174m14-174v174m14-174v174m14-174v174m16-174v174m14-174v174m14-174v174m14-174v174" stroke="#6487bf" opacity=".23" />
          <path d="M9 62l30 21m108 0 30-21M64 20q29 34 58 0" fill="none" stroke="#1e3a8a" strokeWidth="5" />
        </g>
        <text x="93" y="70" textAnchor="middle" fill="#172b57" fontSize="14" fontWeight="700"
          textLength={[...display].length > 8 ? '78' : undefined} lengthAdjust="spacingAndGlyphs">{display}</text>
        <text x="93" y="133" textAnchor="middle" fill="#172b57" fontSize="55" fontWeight="700">{number}</text>
      </svg>
    </div>
  );
}

export function CreateScreen({ onCreate, onBack, disabled, mode = 'normal' }: {
  onCreate: (profile: BaseballProfile) => void;
  onBack: () => void;
  disabled: boolean;
  mode?: CareerMode;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [playerType, setPlayerType] = useState<PlayerType>('batter');
  const [name, setName] = useState('');
  const [number, setNumber] = useState(10);
  const [bats, setBats] = useState<Bats>('R');
  const [pitcherRole, setPitcherRole] = useState<PitcherRole>('starter');
  const [position, setPosition] = useState<DetailedPosition | null>(null);
  const isPitcher = playerType === 'pitcher';
  const steps = isPitcher ? 2 : 3;

  const goTo = (next: 1 | 2 | 3) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const next = () => {
    if (step === 1) return goTo(2);
    const identity = { name: name.trim() || '무명 선수', number };
    if (isPitcher) return onCreate({ ...identity, position: pitcherRole });
    if (step === 2) return goTo(3);
    if (!position) return;
    onCreate({ ...identity, bats, position });
  };

  return (
    <div className="flow">
      <header className="flow-tight">
        <div className="row between">
          <p className="eyebrow">{step} / {steps}단계 · {modeLabels[mode].title}</p>
          <span className="caption">{step === 1 ? '타자·투수' : step === 2 ? '프로필' : '포지션'}</span>
        </div>
        <div className="wizard-progress" aria-hidden="true">
          <span className="wizard-progress-fill" style={{ width: `${step / steps * 100}%` }} />
        </div>
      </header>

      {step === 1 && (
        <section className="card flow">
          <div className="row between wrap">
            <h2>타자·투수 선택</h2>
            <span className="pill">대한민국</span>
          </div>
          <p>대한민국 신인으로 KBO에서 시작해요.</p>
          <div className="segmented baseball-profile-options" role="group" aria-label="타자 또는 투수">
            {playerTypes.map(({ id, label }) => (
              <button type="button" key={id} className={playerType === id ? 'segment selected' : 'segment'}
                aria-pressed={playerType === id} disabled={disabled} onClick={() => setPlayerType(id)}>{label}</button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card flow">
          <div className="flow-tight">
            <h2>선수 프로필 설정</h2>
            <p>유니폼에 새길 이름과 등번호를 정하고 {isPitcher ? '투수 역할을' : '타석 방향을'} 선택하세요.</p>
          </div>
          <BaseballJersey name={name} number={number} />
          <label className="field">
            <span>선수 이름</span>
            <input className="text-input" value={name} maxLength={16} autoComplete="off" placeholder="무명 선수" disabled={disabled} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>등번호</span>
            <select className="text-input" value={number} disabled={disabled} onChange={(event) => setNumber(Number(event.target.value))}>
              {jerseyNumbers.map((option) => <option key={option} value={option}>{option}번</option>)}
            </select>
          </label>
          {isPitcher ? (
            <div className="field">
              <span>투수 역할</span>
              <div className="segmented baseball-profile-options" role="group" aria-label="투수 역할">
                {pitcherRoles.map((role) => (
                  <button type="button" key={role} className={pitcherRole === role ? 'segment selected' : 'segment'}
                    aria-pressed={pitcherRole === role} disabled={disabled} onClick={() => setPitcherRole(role)}>{positionLabels[role]}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="field">
              <span>타석 방향</span>
              <div className="segmented baseball-profile-options baseball-bat-side" role="group" aria-label="타석 방향">
                {batsChoices.map((item) => (
                  <button type="button" key={item.id} className={bats === item.id ? 'segment selected' : 'segment'}
                    aria-pressed={bats === item.id} disabled={disabled} onClick={() => setBats(item.id)}>{item.name}</button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {step === 3 && !isPitcher && (
        <section className="card flow">
          <div className="row between">
            <div className="flow-tight">
              <h2>포지션 선택</h2>
              <p>야구장에서 원하는 포지션을 누르세요.</p>
            </div>
            {position && <span className="pill">{positionLabels[position]}</span>}
          </div>
          <div className="position-pitch baseball-position-field">
            <svg className="position-pitch-lines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
              <path d="M150 245 22 112Q150-63 278 112Z" />
              <path d="m150 245-72-67 72-67 72 67-72 67Z" />
              <circle cx="150" cy="178" r="14" />
            </svg>
            <div className="position-formation" role="group" aria-label="야구장 포지션">
              {fieldPositions.map((item) => (
                <button type="button" className="position-option" key={item.id} style={{ left: item.x, top: item.y }}
                  aria-pressed={position === item.id} disabled={disabled} onClick={() => setPosition(item.id)}>{positionLabels[item.id]}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="cta-dock split">
        <button type="button" className="secondary" data-setup-back disabled={disabled}
          onClick={() => step === 1 ? onBack() : goTo(step === 2 ? 1 : 2)}>이전</button>
        <button type="button" className="primary" disabled={disabled || (step === 3 && !position)} onClick={next}>
          <span>{step === steps ? '커리어 시작' : '다음'}</span><ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
