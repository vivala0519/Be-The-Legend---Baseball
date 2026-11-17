import { clubs, type Club, type League } from './clubs.ts';

export const positionLabels = {
  starter: '선발',
  reliever: '불펜',
  catcher: '포수',
  firstBase: '1루수',
  secondBase: '2루수',
  thirdBase: '3루수',
  shortstop: '유격수',
  leftField: '좌익수',
  centerField: '중견수',
  rightField: '우익수',
  infielder: '내야수',
  outfielder: '외야수',
} as const;
export type PlayerPosition = keyof typeof positionLabels;
export type PitcherRole = 'starter' | 'reliever';
export type Approach = 'contact' | 'power';
export type CareerMode = 'long' | 'normal' | 'express';
export type BatSide = 'R' | 'L' | 'S';

type PlayerOptions = { mode: CareerMode; number: number; bats?: BatSide };
type Skill = 'contact' | 'power' | 'defense';
// A paused period from an older save may still carry its chosen focus.
type PeriodProgress = { start: number; remaining: number; training?: Skill };

type Skills = Record<Skill, number>;
type HitterRole = '유망주' | '백업' | '플래툰' | '주전' | '중심 타자';
type Role = HitterRole | '선발 후보' | '선발 로테이션' | '에이스' | '추격조' | '셋업맨' | '마무리';
type Batting = { pa: number; ab: number; hits: number; hr: number; bb: number; totalBases: number };
export type Pitching = {
  appearances: number;
  starts: number;
  outs: number;
  earnedRuns: number;
  strikeouts: number;
  saves: number;
};

export type Season = Batting & {
  pitching?: Pitching;
  year: number;
  period?: number;
  age: number;
  clubId: string;
  role: Role;
  overall: number;
  teamRank: number;
  champion: boolean;
  momentResult: string | null;
};

export type Career = Partial<PlayerOptions> & {
  name: string;
  nationality: 'KR';
  position?: PlayerPosition;
  archetype?: Skill;
  clubId: string;
  age: number;
  overall: number;
  skills: Skills;
  seed: number;
  seasons: Season[];
  phase: 'draft' | 'prepare' | 'moment' | 'offseason' | 'retired';
  offers: string[];
  moment: {
    contactChance: number;
    powerChance: number;
    pending: Season;
    nextSkills: Skills;
    period?: PeriodProgress;
  } | null;
  momentResult: string | null;
};

export const offerRequirements = {
  NPB: { seasons: 3, overall: 58, minPa: 220, minOps: 0.69 },
  MLB: { seasons: 6, overall: 73, minPa: 300, minOps: 0.79 },
} as const;

export const pitcherOfferRequirements: Record<PitcherRole, Record<'NPB' | 'MLB', {
  seasons: number;
  overall: number;
  minOuts: number;
  maxEra: number;
}>> = {
  starter: {
    NPB: { seasons: 3, overall: 58, minOuts: 255, maxEra: 4.20 },
    MLB: { seasons: 6, overall: 73, minOuts: 375, maxEra: 3.60 },
  },
  reliever: {
    NPB: { seasons: 3, overall: 58, minOuts: 105, maxEra: 4.00 },
    MLB: { seasons: 6, overall: 73, minOuts: 150, maxEra: 3.50 },
  },
};

const maxAge = 40;
const retirementAge = 30;
const clubById = new Map(clubs.map((club) => [club.id, club]));
const infieldSkills: Skills = { contact: 59, power: 46, defense: 51 };
const outfieldSkills: Skills = { contact: 52, power: 60, defense: 46 };
const initialSkills: Record<PlayerPosition, Skills> = {
  // Pitchers use the same ratings scale for command, stuff and stamina.
  starter: { contact: 56, power: 52, defense: 60 },
  reliever: { contact: 54, power: 62, defense: 47 },
  catcher: { contact: 52, power: 46, defense: 63 },
  firstBase: infieldSkills,
  secondBase: infieldSkills,
  thirdBase: infieldSkills,
  shortstop: infieldSkills,
  leftField: outfieldSkills,
  centerField: outfieldSkills,
  rightField: outfieldSkills,
  infielder: infieldSkills,
  outfielder: outfieldSkills,
};
const legacyPositions: Record<Skill, PlayerPosition> = { defense: 'catcher', contact: 'infielder', power: 'outfielder' };

export function getPosition(career: Pick<Career, 'position' | 'archetype'>): PlayerPosition {
  return career.position ?? (career.archetype && legacyPositions[career.archetype]) ?? 'infielder';
}

export function isPitcherPosition(position: PlayerPosition): position is PitcherRole {
  return position === 'starter' || position === 'reliever';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomStream(seed: number, scope: string): () => number {
  let value = seed;
  for (const char of scope) value = Math.imul(value ^ char.charCodeAt(0), 16_777_619);
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomItem<T>(items: T[], random: () => number): T | undefined {
  return items[Math.floor(random() * items.length)];
}

function overall(skills: Skills): number {
  return Math.round(skills.contact * 0.39 + skills.power * 0.36 + skills.defense * 0.25);
}

const leagueBaseline: Record<League, number> = { KBO: 31, NPB: 37, MLB: 44 };

function roleFor(skills: Skills, club: Club): HitterRole {
  const defenseBenefit = Math.max(0, skills.defense - 50) * 0.12;
  const margin = overall(skills) + defenseBenefit - (leagueBaseline[club.league] + club.strength * 0.33);
  if (margin >= 10) return '중심 타자';
  if (margin >= -1) return '주전';
  if (margin >= -5) return '플래툰';
  if (margin >= -11) return '백업';
  return '유망주';
}

export function projectRole(state: Career, clubId: string): Role {
  const club = clubById.get(clubId);
  if (!club) return '유망주';
  const position = getPosition(state);
  return isPitcherPosition(position)
    ? pitcherUsage(state.skills, club, position).role
    : roleFor(state.skills, club);
}

export function createCareer(name: string, position: PlayerPosition, seed: number, options?: PlayerOptions): Career {
  const random = randomStream(seed, 'draft');
  const korean = clubs.filter((club) => club.league === 'KBO').sort((a, b) => a.strength - b.strength);
  const width = Math.max(1, Math.floor(korean.length / 3));
  const offers = [
    randomItem(korean.slice(0, width), random),
    randomItem(korean.slice(width, korean.length - width), random),
    randomItem(korean.slice(korean.length - width), random),
  ].flatMap((club) => (club ? [club.id] : []));
  const skills = { ...initialSkills[position] };
  return {
    ...(options && { mode: options.mode, number: options.number }),
    ...(!isPitcherPosition(position) && options?.bats && { bats: options.bats }),
    name: [...name.trim()].slice(0, 16).join('') || '무명 선수',
    nationality: 'KR',
    position,
    clubId: '',
    age: 18,
    overall: overall(skills),
    skills,
    seed: seed >>> 0,
    seasons: [],
    phase: 'draft',
    offers: [...new Set(offers)],
    moment: null,
    momentResult: null,
  };
}

export function chooseClub(state: Career, clubId: string): Career {
  if (state.phase !== 'draft' && state.phase !== 'offseason') return state;
  if (!state.offers.includes(clubId) || !clubById.has(clubId)) return state;
  return { ...state, clubId, phase: 'prepare', offers: [], momentResult: null };
}

const opportunities: Record<HitterRole, [number, number]> = {
  '유망주': [25, 105],
  '백업': [85, 225],
  '플래툰': [210, 365],
  '주전': [385, 545],
  '중심 타자': [495, 620],
};

function grow(skills: Skills, age: number, random: () => number, legacyTraining?: Skill): Skills {
  const annual = age < 23 ? 3 : age < 28 ? 2 : age < 32 ? 0.8 : age < 35 ? -0.4 : -1.7;
  const focus = age < 32 ? 1.65 : age < 35 ? 0.9 : 0.6;
  const gain = (stat: Skill) => {
    const additional = legacyTraining ? Number(legacyTraining === stat) * focus : focus / 3;
    const variation = (random() - 0.5) * 1.4;
    const potential = 1 - Math.max(0, skills[stat] - 82) * 0.035;
    const change = annual + additional + variation;
    return clamp(skills[stat] + (change > 0 ? change * potential : change), 20, 98);
  };
  return { contact: gain('contact'), power: gain('power'), defense: gain('defense') };
}

function calculateOps(stats: Pick<Batting, 'ab' | 'pa' | 'hits' | 'bb' | 'totalBases'>): number {
  const obp = stats.pa > 0 ? (stats.hits + stats.bb) / stats.pa : 0;
  const slugging = stats.ab > 0 ? stats.totalBases / stats.ab : 0;
  return obp + slugging;
}

export function statsLine(stats: Pick<Batting, 'ab' | 'pa' | 'hits' | 'bb' | 'totalBases'>) {
  const average = stats.ab > 0 ? stats.hits / stats.ab : 0;
  const format = (value: number) => value.toFixed(3).replace(/^0\./, '.');
  return { avg: format(average), ops: format(calculateOps(stats)) };
}

function emptyBatting(): Batting {
  return { pa: 0, ab: 0, hits: 0, hr: 0, bb: 0, totalBases: 0 };
}

export function careerTotals(state: Career): Batting {
  return state.seasons.reduce((totals, row) => ({
    pa: totals.pa + row.pa,
    ab: totals.ab + row.ab,
    hits: totals.hits + row.hits,
    hr: totals.hr + row.hr,
    bb: totals.bb + row.bb,
    totalBases: totals.totalBases + row.totalBases,
  }), emptyBatting());
}

export function pitchingTotals(state: Career): Pitching {
  const total: Pitching = { appearances: 0, starts: 0, outs: 0, earnedRuns: 0, strikeouts: 0, saves: 0 };
  for (const { pitching } of state.seasons) {
    if (!pitching) continue;
    total.appearances += pitching.appearances;
    total.starts += pitching.starts;
    total.outs += pitching.outs;
    total.earnedRuns += pitching.earnedRuns;
    total.strikeouts += pitching.strikeouts;
    total.saves += pitching.saves;
  }
  return total;
}

function calculateEra(pitching: Pitching): number {
  return pitching.outs > 0 ? pitching.earnedRuns * 27 / pitching.outs : 0;
}

export function pitchingLine(pitching: Pitching): { ip: string; era: string } {
  return { ip: `${Math.floor(pitching.outs / 3)}.${pitching.outs % 3}`, era: calculateEra(pitching).toFixed(2) };
}

type PitcherUsage = { role: Role; appearances: [number, number]; outsPerAppearance: number; saveChance: number };

function pitcherUsage(skills: Skills, club: Club, position: PitcherRole): PitcherUsage {
  const margin = overall(skills) - (leagueBaseline[club.league] + club.strength * 0.33);
  if (position === 'starter') {
    if (margin >= 10) return { role: '에이스', appearances: [27, 32], outsPerAppearance: 19, saveChance: 0 };
    if (margin >= 0) return { role: '선발 로테이션', appearances: [21, 28], outsPerAppearance: 16, saveChance: 0 };
    if (margin >= -8) return { role: '선발 후보', appearances: [9, 19], outsPerAppearance: 14, saveChance: 0 };
    return { role: '유망주', appearances: [3, 9], outsPerAppearance: 12, saveChance: 0 };
  }
  if (margin >= 10) return { role: '마무리', appearances: [52, 65], outsPerAppearance: 3, saveChance: 0.55 };
  if (margin >= 0) return { role: '셋업맨', appearances: [44, 62], outsPerAppearance: 4, saveChance: 0.10 };
  if (margin >= -8) return { role: '추격조', appearances: [30, 47], outsPerAppearance: 4, saveChance: 0.025 };
  return { role: '유망주', appearances: [12, 27], outsPerAppearance: 4, saveChance: 0.01 };
}

function simulatePitching(skills: Skills, league: League, position: PitcherRole, usage: PitcherUsage, random: () => number): Pitching {
  const [min, max] = usage.appearances;
  const workload: Record<League, number> = { KBO: 1, NPB: 0.99, MLB: 1.08 };
  const appearances = Math.round((min + random() * (max - min)) * workload[league]);
  const starter = position === 'starter';
  const pitching: Pitching = { appearances, starts: starter ? appearances : 0, outs: 0, earnedRuns: 0, strikeouts: 0, saves: 0 };
  const difficulty: Record<League, number> = { KBO: 0, NPB: 0.24, MLB: 0.42 };
  const expectedEra = clamp(4.45 - (overall(skills) - 53) * 0.080 + difficulty[league] - (starter ? 0 : 0.20), 1.55, 7.20);
  const strikeoutChance = clamp(0.25 + (skills.power - 50) * 0.004 + (starter ? 0 : 0.015) - difficulty[league] * 0.035, 0.12, 0.47);
  for (let game = 0; game < appearances; game += 1) {
    const variation = (random() - 0.5) * (starter ? 8 : 4);
    const outs = Math.round(clamp(usage.outsPerAppearance + variation, 1, starter ? 27 : 9));
    pitching.outs += outs;
    for (let out = 0; out < outs; out += 1) {
      if (random() < strikeoutChance) pitching.strikeouts += 1;
      if (random() < expectedEra / 27) pitching.earnedRuns += 1;
    }
    if (!starter && random() < usage.saveChance) pitching.saves += 1;
  }
  return pitching;
}

function recordPlateAppearance(stats: Batting, result: 'walk' | 'out' | 1 | 2 | 3 | 4): void {
  stats.pa += 1;
  if (result === 'walk') {
    stats.bb += 1;
    return;
  }
  stats.ab += 1;
  if (result === 'out') return;
  stats.hits += 1;
  stats.totalBases += result;
  if (result === 4) stats.hr += 1;
}

function simulateBatting(skills: Skills, league: League, pa: number, random: () => number, legacyTraining?: Skill): Batting {
  const stats = emptyBatting();
  const difficulty: Record<League, number> = { KBO: 0, NPB: 0.019, MLB: 0.037 };
  const patience = clamp(0.078 + (skills.contact - 52) * 0.0011, 0.042, 0.15);
  const approachBonus = legacyTraining === 'contact' ? 0.012 : legacyTraining === 'power' ? -0.009 : 0;
  const hitChance = clamp(0.252 + (skills.contact - 52) * 0.0028 + approachBonus - difficulty[league], 0.15, 0.38);
  const homerAmongHits = clamp(0.084 + (skills.power - 50) * 0.0052 - difficulty[league] + (legacyTraining === 'power' ? 0.025 : 0), 0.025, 0.35);

  for (let index = 0; index < pa; index += 1) {
    if (random() < patience) {
      recordPlateAppearance(stats, 'walk');
      continue;
    }
    if (random() >= hitChance) {
      recordPlateAppearance(stats, 'out');
      continue;
    }
    const extraBases = random();
    if (extraBases < homerAmongHits) recordPlateAppearance(stats, 4);
    else if (extraBases < homerAmongHits + 0.013) recordPlateAppearance(stats, 3);
    else if (extraBases < homerAmongHits + 0.208) recordPlateAppearance(stats, 2);
    else recordPlateAppearance(stats, 1);
  }
  return stats;
}

function foreignEligible(state: Career, latest: Season, league: 'NPB' | 'MLB'): boolean {
  const position = getPosition(state);
  if (isPitcherPosition(position)) {
    const rule = pitcherOfferRequirements[position][league];
    return latest.pitching !== undefined && state.seasons.length >= rule.seasons &&
      state.overall >= rule.overall && latest.pitching.outs >= rule.minOuts && calculateEra(latest.pitching) <= rule.maxEra;
  }
  const rule = offerRequirements[league];
  return state.seasons.length >= rule.seasons &&
    state.overall >= rule.overall &&
    latest.pa >= rule.minPa &&
    calculateOps(latest) >= rule.minOps;
}

function createOffers(state: Career, latest: Season): string[] {
  const random = randomStream(state.seed, 'offers/' + latest.year + '/' + latest.clubId);
  const league = clubById.get(latest.clubId)?.league;
  const offers = [latest.clubId];
  const add = (target: League, count: number) => {
    const available = clubs.filter((club) => club.league === target && !offers.includes(club.id));
    for (let index = 0; index < count && available.length; index += 1) {
      const selected = Math.floor(random() * available.length);
      offers.push(available.splice(selected, 1)[0].id);
    }
  };

  if (latest.year % 3 === 0) add(league === 'KBO' ? 'KBO' : league ?? 'KBO', 2);
  if (league !== 'KBO' && latest.year % 2 === 0) add('KBO', 1);
  if (league === 'KBO' && foreignEligible(state, latest, 'NPB')) add('NPB', 1);
  if (league !== 'MLB' && foreignEligible(state, latest, 'MLB')) add('MLB', 1);
  return offers;
}

function teamOutcome(state: Career, row: Season, decisiveBoost: number): { teamRank: number; champion: boolean } {
  const club = clubById.get(row.clubId);
  if (!club) return { teamRank: 1, champion: false };
  const random = randomStream(state.seed, 'standings/' + row.year + '/' + club.league);
  const impact = row.pitching
    ? clamp((4.1 - calculateEra(row.pitching)) * row.pitching.outs * 0.006, -4.5, 4.5)
    : row.pa > 0 ? clamp((calculateOps(row) - 0.72) * row.pa * 0.034, -4.5, 4.5) : 0;
  const standings = clubs
    .filter((team) => team.league === club.league)
    .map((team) => ({
      id: team.id,
      rating: team.strength + (random() - 0.5) * 29 + (team.id === row.clubId ? impact + decisiveBoost : 0),
    }))
    .sort((a, b) => b.rating - a.rating);
  const teamRank = standings.findIndex((team) => team.id === row.clubId) + 1;
  const playoffOdds = [0.45, 0.27, 0.16, 0.08];
  return { teamRank, champion: random() < (playoffOdds[teamRank - 1] ?? 0) };
}

function finishSeason(state: Career, pending: Season, nextSkills: Skills, decisiveBoost = 0): Career {
  const result = { ...pending, ...teamOutcome(state, pending, decisiveBoost) };
  const age = state.age + 1;
  const next: Career = {
    ...state,
    age,
    skills: nextSkills,
    overall: result.overall,
    seasons: [...state.seasons, result],
    phase: age >= maxAge ? 'retired' : 'offseason',
    offers: [],
    moment: null,
    momentResult: result.momentResult,
  };
  return next.phase === 'retired' ? next : { ...next, offers: createOffers(next, result) };
}

export function playSeason(state: Career): Career {
  return simulateSeason(state);
}

function simulateSeason(state: Career, legacyTraining?: Skill): Career {
  if (state.phase !== 'prepare') return state;
  const club = clubById.get(state.clubId);
  if (!club) return state;

  const year = state.seasons.length + 1;
  const random = randomStream(state.seed, 'season/' + year + '/' + club.id);
  const nextSkills = grow(state.skills, state.age, random, legacyTraining);
  const position = getPosition(state);
  if (isPitcherPosition(position)) {
    const usage = pitcherUsage(state.skills, club, position);
    return finishSeason(state, {
      ...emptyBatting(),
      pitching: simulatePitching(nextSkills, club.league, position, usage, random),
      year,
      age: state.age,
      clubId: club.id,
      role: usage.role,
      overall: overall(nextSkills),
      teamRank: 0,
      champion: false,
      momentResult: null,
    }, nextSkills);
  }
  const role = roleFor(state.skills, club);
  const [min, max] = opportunities[role];
  const workload: Record<League, number> = { KBO: 1, NPB: 0.99, MLB: 1.12 };
  const pa = Math.round((min + random() * (max - min)) * workload[club.league]);
  const hasMoment = [2, 6, 11].includes(year) && pa >= 180;
  const pending: Season = {
    ...simulateBatting(nextSkills, club.league, pa - Number(hasMoment), random, legacyTraining),
    year,
    age: state.age,
    clubId: club.id,
    role,
    overall: overall(nextSkills),
    teamRank: 0,
    champion: false,
    momentResult: null,
  };
  if (!hasMoment) return finishSeason(state, pending, nextSkills);

  const adjustment: Record<League, number> = { KBO: 0, NPB: 0.025, MLB: 0.045 };
  const contactChance = clamp(0.27 + (nextSkills.contact - 52) * 0.0031 - adjustment[club.league], 0.15, 0.46);
  const powerChance = clamp(0.08 + (nextSkills.power - 50) * 0.003 - adjustment[club.league] * 0.35, 0.035, 0.24);
  return {
    ...state,
    phase: 'moment',
    moment: { contactChance, powerChance, pending, nextSkills },
    momentResult: null,
  };
}

export function resolveMoment(state: Career, approach: Approach): Career {
  if (state.phase !== 'moment' || !state.moment) return state;
  const { contactChance, powerChance, pending, nextSkills } = state.moment;
  const random = randomStream(state.seed, 'moment/' + pending.year + '/' + pending.clubId);
  const result = { ...pending };
  const draw = random();
  let boost = 0;
  if (approach === 'contact' && draw < contactChance) {
    recordPlateAppearance(result, 1);
    result.momentResult = '동점 적시타! 2루 주자가 홈을 밟았습니다.';
    boost = 0.3;
  } else if (approach === 'power' && draw < powerChance) {
    recordPlateAppearance(result, 4);
    result.momentResult = '끝내기 2점 홈런! 한 방으로 승부를 뒤집었습니다.';
    boost = 0.9;
  } else {
    recordPlateAppearance(result, 'out');
    result.momentResult = approach === 'contact'
      ? '범타. 2루 주자를 불러들이지 못했습니다.'
      : '삼진. 큰 스윙이 공을 비껴갔습니다.';
  }
  return finishSeason(state, result, nextSkills, boost);
}

export function periodLength(mode?: CareerMode): 1 | 2 | 3 {
  if (mode === 'express') return 3;
  if (mode === 'normal') return 2;
  return 1;
}

function canContinuePeriod(state: Career): boolean {
  if (state.phase !== 'offseason' || state.age === retirementAge || !state.offers.includes(state.clubId)) return false;
  const league = clubById.get(state.clubId)?.league;
  return !state.offers.some((id) => {
    const target = clubById.get(id)?.league;
    return target !== undefined && target !== league;
  });
}

function continuePeriod(state: Career, period: PeriodProgress): Career {
  let current = state;
  for (let remaining = period.remaining; remaining > 0; remaining -= 1) {
    if (canContinuePeriod(current)) current = chooseClub(current, current.clubId);
    if (current.phase !== 'prepare') return current;
    const next = simulateSeason(current, period.training);
    if (next === current) return current;
    if (next.phase === 'moment' && next.moment) {
      return {
        ...next,
        moment: {
          ...next.moment,
          pending: { ...next.moment.pending, period: period.start },
          period: { ...period, remaining: remaining - 1 },
        },
      };
    }
    const latest = next.seasons.at(-1);
    if (!latest) return next;
    current = { ...next, seasons: [...next.seasons.slice(0, -1), { ...latest, period: period.start }] };
  }
  return current;
}

export function playPeriod(state: Career): Career {
  if (state.phase !== 'prepare') return state;
  return continuePeriod(state, { start: state.seasons.length + 1, remaining: periodLength(state.mode) });
}

export function resolvePeriodMoment(state: Career, approach: Approach): Career {
  const resolved = resolveMoment(state, approach);
  const period = state.moment?.period;
  if (!period || resolved === state) return resolved;
  const next = continuePeriod(resolved, period);
  if (next === resolved || next.phase === 'moment') return next;
  return { ...next, momentResult: resolved.momentResult };
}

export function canRetire(state: Career): boolean {
  return state.phase === 'offseason' && state.age >= retirementAge;
}

export function retire(state: Career): Career {
  return canRetire(state) ? { ...state, phase: 'retired', offers: [] } : state;
}
