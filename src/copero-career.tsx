import { useEffect, useRef, useState } from 'react';
import { clubs, type Club, type League } from './clubs';
import {
  canRetire,
  careerTotals,
  getPosition,
  isPitcherPosition,
  offerRequirements,
  periodLength,
  pitcherOfferRequirements,
  pitchingLine,
  pitchingTotals,
  positionLabels,
  projectRole,
  statsLine,
  type Approach,
  type Career,
  type PitcherRole,
  type Pitching,
  type PlayerPosition,
  type Season,
} from './engine';
import { ChevronDown, ChevronRight, Close } from './icons';

const clubById = new Map(clubs.map((club) => [club.id, club]));
const leagues: League[] = ['KBO', 'NPB', 'MLB'];
const batSides = { R: '우타', L: '좌타', S: '스위치 타자' };
const pitcherRoles: PitcherRole[] = ['starter', 'reliever'];

function displayPitching(stats: Pitching) {
  const { ip, era } = pitchingLine(stats);
  return { ip, era: stats.outs > 0 ? era : '–' };
}

type Playback = 'idle' | 'closing' | 'recording' | 'opening';
type Props = {
  career: Career;
  playback: Playback;
  recordingYear: number | null;
  disabled: boolean;
  onClub: (clubId: string) => void;
  onSeason: () => void;
  onMoment: (approach: Approach) => void;
  onRetire: () => void;
  onRestart: () => void;
  onReplay?: () => void;
};

function ovrClass(ovr: number) {
  return `ovr-tier-${[99, 95, 90, 80, 70].find((tier) => ovr >= tier) ?? 60}`;
}

function Trophy({ label = '우승' }: { label?: string }) {
  return (
    <svg role="img" aria-label={label} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <title>{label}</title><path d="M8 21h8m-4-4v4M6 4h12v6a6 6 0 0 1-12 0V4Zm0 2H3v3a4 4 0 0 0 4 4m11-7h3v3a4 4 0 0 1-4 4" />
    </svg>
  );
}

function ClubMark({ club }: { club?: Club }) {
  return <span className={`pill baseball-league-mark ${club?.league.toLowerCase() ?? ''}`}>{club?.league ?? '신인'}</span>;
}

export function LeagueCatalog({ position }: { position?: PlayerPosition } = {}) {
  const pitchRoles = position === undefined ? pitcherRoles : isPitcherPosition(position) ? [position] : [];
  return (
    <details className="card baseball-league-catalog">
      <summary className="row between"><strong>진출 가능 리그</strong><span className="row caption">KBO / NPB / MLB <ChevronDown size={18} /></span></summary>
      <div className="flow">
        {leagues.map((league) => {
          const teams = clubs.filter((club) => club.league === league);
          const rule = league === 'KBO' ? null : offerRequirements[league];
          return (
            <section className="flow-tight" key={league} aria-label={`${league} 구단`}>
              <h3>{league} · {teams.length}개 구단</h3>
              {rule && (position === undefined || !isPitcherPosition(position)) && (
                <p className="caption">타자 · {rule.seasons}시즌 이상 · OVR {rule.overall} 이상 · 직전 시즌 {rule.minPa}타석 및 OPS {rule.minOps.toFixed(3)} 이상</p>
              )}
              {league !== 'KBO' && pitchRoles.map((role) => {
                const requirement = pitcherOfferRequirements[role][league];
                const innings = `${Math.floor(requirement.minOuts / 3)}${requirement.minOuts % 3 ? `.${requirement.minOuts % 3}` : ''}`;
                return <p className="caption" key={role}>{positionLabels[role]} · {requirement.seasons}시즌 이상 · OVR {requirement.overall} 이상 · 직전 시즌 {innings}이닝 이상 및 ERA {requirement.maxEra.toFixed(2)} 이하</p>;
              })}
              <ul>{teams.map((club) => <li key={club.id}>{club.name}</li>)}</ul>
            </section>
          );
        })}
      </div>
    </details>
  );
}

function CareerHeader({ career }: { career: Career }) {
  const club = clubById.get(career.clubId);
  const position = getPosition(career);
  const pitcher = isPitcherPosition(position);
  const batting = careerTotals(career);
  const pitching = pitchingTotals(career);
  const { avg, ops } = statsLine(batting);
  const { ip, era } = displayPitching(pitching);
  const totals = pitcher
    ? [['통산 이닝', ip], ['ERA', era], ['탈삼진', pitching.strikeouts], position === 'starter' ? ['선발', pitching.starts] : ['세이브', pitching.saves]]
    : [['통산 타석', batting.pa], ['홈런', batting.hr], ['타율', avg], ['OPS', ops]];
  const peak = Math.max(career.overall, ...career.seasons.map((season) => season.overall));
  const championships = leagues.map((league) => ({ league, wins: career.seasons.filter((season) => season.champion && clubById.get(season.clubId)?.league === league).length }));
  return (
    <section className="career-header-card" aria-label="선수 요약 정보">
      <div className="career-header-top">
        <div className="career-header-identity">
          <div className={`ovr-badge ${ovrClass(career.overall)}`}><span>OVR</span><strong>{career.overall}</strong></div>
          <ClubMark club={club} />
          <div className="career-header-titles">
            <strong className="career-club-name">{club?.name ?? '지명 대기'}</strong>
            <div className="career-meta-row"><span>대한민국</span><span className="pos-pill">{career.name} #{career.number ?? 10} · {positionLabels[position]}{!pitcher && ` · ${batSides[career.bats ?? 'R']}`}</span></div>
          </div>
        </div>
        <div className="career-header-QuickStats">
          <div className="quick-stat"><span>나이</span><strong>{career.age}세</strong></div>
          <div className="quick-stat"><span>최고 OVR</span><strong>{peak}</strong></div>
        </div>
      </div>
      <div className="career-totals-strip">
        {totals.map(([label, stat]) => <div className="totals-cell" key={label}><span>{label}</span><strong>{stat}</strong></div>)}
      </div>
      <div className="trophy-showcase-bar" aria-label="트로피 진열장">
        {championships.every(({ wins }) => !wins) && <span className="caption">아직 획득한 트로피가 없어요</span>}
        {championships.filter(({ wins }) => wins).map(({ league, wins }) => (
          <span className="showcase-chip" key={league}><Trophy label={`${league} 우승`} /><span className="showcase-chip-name">{league} 우승</span>{wins > 1 && <strong>×{wins}</strong>}</span>
        ))}
      </div>
    </section>
  );
}

function ClubOffer({ club, career, disabled, onChoose }: { club: Club; career: Career; disabled: boolean; onChoose: () => void }) {
  const action = career.phase === 'draft' ? '입단' : club.id === career.clubId ? '잔류' : '이적';
  return (
    <button type="button" className="decision-card club-offer-card" disabled={disabled} onClick={onChoose}>
      <div className="club-row">
        <ClubMark club={club} />
        <div className="offer-card-body">
          <div className="row between"><strong>{club.name}</strong><span className="offer-action-pill">{action}</span></div>
          <p className="caption">전력 {club.strength} · 예상 입지 <strong>{projectRole(career, club.id)}</strong></p>
        </div>
      </div>
    </button>
  );
}

type TimelineEntry = {
  age: string;
  season: Season;
  summary: Season;
  pitching?: Pitching;
  titles: number;
};

function timelineEntries(career: Career, grouped: boolean): TimelineEntry[] {
  const periods = new Map<number, Season[]>();
  for (const season of career.seasons) {
    const key = grouped ? season.period ?? season.year : season.year;
    const period = periods.get(key);
    if (period) period.push(season);
    else periods.set(key, [season]);
  }
  return [...periods.values()].map((period) => {
    const first = period[0];
    const season = period[period.length - 1];
    const summary = { ...season, pa: 0, ab: 0, hits: 0, hr: 0, bb: 0, totalBases: 0 };
    for (const row of period) {
      for (const key of ['pa', 'ab', 'hits', 'hr', 'bb', 'totalBases'] as const) summary[key] += row[key];
    }
    return {
      age: first.age === season.age ? `${first.age}` : `${first.age}–${season.age}`,
      season,
      summary,
      pitching: period.some((row) => row.pitching) ? pitchingTotals({ ...career, seasons: period }) : undefined,
      titles: period.filter((row) => row.champion).length,
    };
  });
}

function Retirement({ career, disabled, onReplay, onRestart }: Pick<Props, 'career' | 'disabled' | 'onReplay' | 'onRestart'>) {
  const summary = useRef<HTMLDialogElement>(null);
  const position = getPosition(career);
  const pitcher = isPitcherPosition(position);
  const batting = careerTotals(career);
  const pitching = pitchingTotals(career);
  const { avg, ops } = statsLine(batting);
  const { ip, era } = displayPitching(pitching);
  const peak = Math.max(career.overall, ...career.seasons.map((row) => row.overall));
  const careerClubs = [...new Set(career.seasons.map((season) => season.clubId))];
  const summaryStats = pitcher
    ? [['시즌', career.seasons.length], ['경기', pitching.appearances], ['이닝', ip], ['ERA', era], ['탈삼진', pitching.strikeouts], position === 'starter' ? ['선발', pitching.starts] : ['세이브', pitching.saves], ['최고 OVR', peak]]
    : [['시즌', career.seasons.length], ['타석', batting.pa], ['홈런', batting.hr], ['타율', avg], ['OPS', ops], ['최고 OVR', peak]];
  return (
    <section className="career-decision-panel retired-panel" aria-label="은퇴 완료">
      <div className="flow-tight">
        <span className="pill">커리어 종료 · {career.age}세 은퇴</span>
        <h2>선수 생활이 막을 내렸습니다</h2>
        <p className="caption">{pitcher ? `통산 ${ip}이닝 · 탈삼진 ${pitching.strikeouts}개` : `통산 ${batting.pa}타석 · ${batting.hr}홈런`} · 최고 OVR {peak}</p>
      </div>
      <div className="cta-dock split">
        <button type="button" className="secondary" disabled={disabled} onClick={() => summary.current?.showModal()}>요약 보기</button>
        <button type="button" className="primary" disabled={disabled} onClick={onReplay ?? onRestart}>{onReplay ? '다시 플레이' : '새 선수 만들기'}</button>
      </div>
      {onReplay && <button type="button" className="text-link-btn center" disabled={disabled} onClick={onRestart}>새 선수 프로필 만들기</button>}
      <dialog className="summary-modal card confirm-dialog baseball-summary" ref={summary} aria-labelledby="baseball-summary-title" onCancel={(event) => { event.preventDefault(); summary.current?.close(); }}>
        <div className="flow">
          <div className="row between">
            <h2 id="baseball-summary-title">{career.name}의 커리어</h2>
            <button type="button" className="icon-close-btn" aria-label="요약 닫기" onClick={() => summary.current?.close()}><Close size={18} /></button>
          </div>
          <div className="summary-grid">
            {summaryStats.map(([label, stat]) => <div key={label}><span>{label}</span><strong>{stat}</strong></div>)}
          </div>
          <h3>소속 구단</h3>
          <div className="summary-clubs-list">
            {careerClubs.map((id) => {
              const club = clubById.get(id);
              const seasons = career.seasons.filter((season) => season.clubId === id);
              return <div className="summary-club-card" key={id}><div className="row between"><strong>{club?.name}</strong><ClubMark club={club} /></div><p className="caption">{seasons.length}시즌 · 우승 {seasons.filter((season) => season.champion).length}회</p></div>;
            })}
          </div>
        </div>
      </dialog>
    </section>
  );
}

export function CareerScreen({ career, playback, recordingYear, disabled, onClub, onSeason, onMoment, onRetire, onRestart, onReplay }: Props) {
  const [view, setView] = useState<'period' | 'season'>('period');
  const decision = useRef<HTMLDivElement>(null);
  const timeline = useRef<HTMLElement>(null);
  const previousPlayback = useRef<Playback>(playback);
  const animating = playback !== 'idle';
  const concealed = playback === 'closing' || playback === 'recording';
  const span = periodLength(career.mode);
  const canGroup = span > 1 && career.seasons.length > 0;
  const groupByPeriod = view === 'period' && !animating;
  const position = getPosition(career);
  const pitcher = isPitcherPosition(position);
  const entries = timelineEntries(career, groupByPeriod);
  const futureAges: number[] = [];
  if (groupByPeriod && career.phase !== 'retired') {
    for (let age = career.age + span; age < 40; age += span) futureAges.push(age);
  }

  useEffect(() => {
    const justFinished = previousPlayback.current === 'opening' && playback === 'idle';
    previousPlayback.current = playback;
    if (playback !== 'recording' && !justFinished) return;
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = justFinished ? decision.current : timeline.current?.querySelector('[data-recording-row]') ?? timeline.current;
      target?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: justFinished ? 'start' : 'end' });
    });
    return () => cancelAnimationFrame(frame);
  }, [playback, recordingYear]);

  const latest = career.seasons.at(-1);
  const latestPitching = latest?.pitching;
  const lastStats = latestPitching ? `${displayPitching(latestPitching).ip}이닝 · ERA ${displayPitching(latestPitching).era} · 탈삼진 ${latestPitching.strikeouts}개`
    : latest ? `${latest.pa}타석 · OPS ${statsLine(latest).ops}` : '';
  const stageTitle = career.phase === 'draft' ? '신인 지명' : career.phase === 'prepare' ? '시즌 준비' : career.phase === 'moment' ? '결정적 한 타석' : '스토브리그';
  const playbackStatus = playback === 'closing' ? '선택한 결정을 반영하고 있어요'
    : playback === 'recording' ? recordingYear === null ? '시즌 기록을 준비하고 있어요' : `${career.seasons.find((season) => season.year === recordingYear)?.age ?? career.age}세 시즌 기록 중`
    : playback === 'opening' ? '다음 커리어 결정을 확인하세요' : '';

  return (
    <div className="career-hub" data-playback={playback} aria-busy={disabled || animating}>
      <CareerHeader career={career} />

      <div ref={decision} className="career-decision-transition" inert={animating} aria-hidden={concealed}>
        <div className="career-decision-transition-inner">
          {career.phase === 'retired' ? (
            <Retirement career={career} disabled={disabled || animating} onReplay={onReplay} onRestart={onRestart} />
          ) : (
            <section className="career-decision-panel" aria-label="커리어 결정">
              <div className="decision-header">
                <div className="row between"><span className="pill">{career.age}세 결정</span></div>
                <h2>{stageTitle}</h2>
                {career.phase === 'draft' && <p>첫 프로 구단을 골라보세요. 전력이 낮은 팀에서는 출전 기회를 얻기 쉬워요.</p>}
                {career.phase === 'offseason' && <p>소속 팀에 남거나 영입 제안을 수락할 수 있어요.</p>}
                {career.phase === 'offseason' && latest && <p className="caption">지난 시즌 {lastStats} · {latest.champion ? '우승' : `리그 ${latest.teamRank}위`}</p>}
                {career.phase === 'offseason' && career.momentResult && <p className="caption" role="status">{career.momentResult}</p>}
                {career.phase === 'prepare' && <p>소속 구단에서 다음 시즌을 시작하세요.</p>}
              </div>

              {career.phase === 'moment' && career.moment ? (
                <div className="penalty-decision-box">
                  <div className="penalty-goal-frame"><span>9회 말 · 1사 2루 · 한 점 차로 뒤지고 있어요</span></div>
                  <div className="decision-options-grid two-col">
                    <button type="button" className="decision-card penalty-btn" disabled={disabled || animating} onClick={() => onMoment('contact')}><strong>컨택 위주</strong><span className="caption">동점 적시타 {Math.round(career.moment.contactChance * 100)}%</span></button>
                    <button type="button" className="decision-card penalty-btn" disabled={disabled || animating} onClick={() => onMoment('power')}><strong>장타 노리기</strong><span className="caption">끝내기 홈런 {Math.round(career.moment.powerChance * 100)}%</span></button>
                  </div>
                </div>
              ) : career.phase === 'prepare' ? (
                <button type="button" className="primary" disabled={disabled || animating} onClick={onSeason}>시즌 진행하기 <ChevronRight size={18} /></button>
              ) : (
                <div className="decision-options-grid">
                  {career.offers.map((id) => {
                    const club = clubById.get(id);
                    return club && <ClubOffer key={id} club={club} career={career} disabled={disabled || animating} onChoose={() => onClub(id)} />;
                  })}
                  {canRetire(career) && <button type="button" className="decision-card retire-card" disabled={disabled || animating} onClick={onRetire}><strong>은퇴하기</strong><span className="caption">지금까지 쌓은 기록으로 커리어를 마무리해요.</span></button>}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <section ref={timeline} className="career-timeline-card baseball-timeline" aria-label="커리어 타임라인">
        <p className="career-playback-status" role="status" aria-live="polite">{playbackStatus}</p>
        <div className="timeline-toolbar">
          <strong>커리어 기록</strong>
          {canGroup && (
            <div className="timeline-toggle" role="group" aria-label="기록 보기 단위">
              <button type="button" className={groupByPeriod ? 'toggle-btn active' : 'toggle-btn'} aria-pressed={groupByPeriod} disabled={animating} onClick={() => setView('period')}>기간별</button>
              <button type="button" className={!groupByPeriod ? 'toggle-btn active' : 'toggle-btn'} aria-pressed={!groupByPeriod} disabled={animating} onClick={() => setView('season')}>시즌별</button>
            </div>
          )}
        </div>
        <div role="table" aria-label="커리어 기록표" className="timeline-rows">
          <div className="timeline-table-head" role="row">
            {['나이', '소속 구단 · 수상', 'OVR', ...(pitcher ? ['이닝', 'ERA', 'K'] : ['타석', '홈런', 'OPS'])].map((title) => (
              <span role="columnheader" key={title} aria-label={title === 'K' ? '탈삼진' : undefined}>{title}</span>
            ))}
          </div>
          {entries.map(({ age, season, summary, pitching, titles }) => {
            const club = clubById.get(season.clubId);
            const isRecording = playback === 'recording' && recordingYear === season.year;
            const line = pitching ? displayPitching(pitching) : null;
            const rowStats = pitcher ? [line?.ip ?? '–', line?.era ?? '–', pitching?.strikeouts ?? '–'] : [summary.pa, summary.hr, statsLine(summary).ops];
            return (
              <div key={season.year} role="row" data-recording-row={isRecording || undefined} className={`timeline-row completed${isRecording ? ' recording-row' : ''}`}>
                <span role="cell" className="age-pill active">{age}</span>
                <div role="cell" className="timeline-club-cell" title={`${club?.name ?? '구단 미정'} · ${season.role} · ${season.teamRank}위`}>
                  <span className="timeline-club-name">{club?.name ?? '구단 미정'}</span>{titles > 0 && <Trophy label={`${titles}회 우승`} />}
                </div>
                <span role="cell" className={`ovr-pill ${ovrClass(season.overall)}`}>{season.overall}</span>
                {rowStats.map((stat, index) => <span role="cell" className="stat-cell" key={index}>{stat}</span>)}
              </div>
            );
          })}
          {career.phase !== 'retired' && !animating && (
            <div className="timeline-row active-slot" role="row">
              <span className="age-pill active" role="cell">{career.age}</span>
              <span className="timeline-club-cell pending-text" role="cell">{stageTitle}</span>
              <span className={`ovr-pill ${ovrClass(career.overall)}`} role="cell">{career.overall}</span>
              <span className="stat-cell muted" role="cell">–</span><span className="stat-cell muted" role="cell">–</span><span className="stat-cell muted" role="cell">–</span>
            </div>
          )}
          {futureAges.map((age) => (
            <div key={age} className="timeline-row locked" role="row" aria-hidden="true">
              <span className="age-pill locked" role="cell">{age}</span>
              <span className="timeline-club-cell muted-dash" role="cell">–</span>
              <span className="stat-cell muted" role="cell">–</span><span className="stat-cell muted" role="cell">–</span>
              <span className="stat-cell muted" role="cell">–</span><span className="stat-cell muted" role="cell">–</span>
            </div>
          ))}
        </div>
      </section>
      <LeagueCatalog position={position} />
    </div>
  );
}
