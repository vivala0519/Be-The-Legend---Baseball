import assert from 'node:assert/strict';
import test from 'node:test';
import { clubs } from './clubs.ts';
import {
  canRetire,
  chooseClub,
  createCareer,
  getPosition,
  isPitcherPosition,
  pitchingLine,
  pitchingTotals,
  playPeriod,
  playSeason,
  positionLabels,
  resolveMoment,
  resolvePeriodMoment,
  retire,
  type Career,
} from './engine.ts';

const clubById = new Map(clubs.map((club) => [club.id, club]));

function takeTurn(state: Career, acceptNpb: boolean): Career {
  switch (state.phase) {
    case 'draft':
    case 'offseason': {
      const mlb = state.offers.find((id) => clubById.get(id)?.league === 'MLB');
      const npb = acceptNpb && state.offers.find((id) => clubById.get(id)?.league === 'NPB');
      return chooseClub(state, mlb || npb || state.offers[0]);
    }
    case 'prepare':
      return playSeason(state);
    case 'moment':
      return resolveMoment(state, 'contact');
    case 'retired':
      return state;
  }
}

function completeCareer(acceptNpb: boolean): Career {
  let state = createCareer('  ', 'infielder', 17);
  for (let turn = 0; turn < 80 && state.phase !== 'retired'; turn += 1) {
    state = takeTurn(state, acceptNpb);
  }
  assert.equal(state.phase, 'retired');
  return state;
}

test('Korean rookies start in KBO and can advance to MLB with or without an NPB stint', () => {
  const draft = createCareer('신인', 'infielder', 17);
  assert.equal(draft.nationality, 'KR');
  assert.equal(draft.age, 18);
  assert.equal(draft.offers.length, 3);
  assert.ok(draft.offers.every((id) => clubById.get(id)?.league === 'KBO'));
  const foreign = clubs.find((club) => club.league === 'MLB');
  assert.ok(foreign);
  assert.equal(chooseClub(draft, foreign.id), draft);

  const throughJapan = completeCareer(true);
  const directly = completeCareer(false);
  const playedLeagues = (state: Career) => [
    ...new Set(state.seasons.map((season) => clubById.get(season.clubId)?.league)),
  ];
  assert.deepEqual(playedLeagues(throughJapan), ['KBO', 'NPB', 'MLB']);
  assert.deepEqual(playedLeagues(directly), ['KBO', 'MLB']);
  assert.deepEqual(completeCareer(true), throughJapan);
});

test('the decisive moment consumes exactly one plate appearance even if called twice', () => {
  let state = createCareer('신인', 'outfielder', 4);
  for (let turn = 0; turn < 15 && state.phase !== 'moment'; turn += 1) {
    state = takeTurn(state, false);
  }
  assert.equal(state.phase, 'moment');
  assert.ok(state.moment);

  const result = resolveMoment(state, 'power');
  const season = result.seasons.at(-1);
  assert.ok(season);
  assert.equal(season.pa, state.moment.pending.pa + 1);
  assert.equal(season.ab, state.moment.pending.ab + 1);
  assert.equal(result.seasons.length, state.seasons.length + 1);
  assert.equal(resolveMoment(result, 'power'), result);
});

test('season totals stay consistent through retirement and each league uses its own standings', () => {
  const state = completeCareer(true);
  assert.equal(state.name, '무명 선수');
  assert.equal(state.age, 40);
  assert.equal(state.seasons.length, 22);
  for (const row of state.seasons) {
    assert.equal(row.pa, row.ab + row.bb);
    assert.ok(row.ab >= row.hits && row.hits >= row.hr);
    assert.ok(row.totalBases >= row.hits + row.hr * 3 && row.totalBases <= row.hits * 4);
    const league = clubById.get(row.clubId)?.league;
    assert.ok(row.teamRank >= 1 && row.teamRank <= clubs.filter((club) => club.league === league).length);
  }

  let early = createCareer('신인', 'catcher', 5);
  assert.equal(retire(early), early);
  for (let turn = 0; turn < 70 && !canRetire(early); turn += 1) {
    early = takeTurn(early, false);
  }
  assert.equal(early.age, 30);
  assert.equal(retire(early).phase, 'retired');
});

test('progression modes group one, two, or three seasons and old saves keep one-season decisions', () => {
  for (const [mode, count] of [[undefined, 1], ['long', 1], ['normal', 2], ['express', 3]] as const) {
    const options = mode ? { mode, number: 18, bats: 'L' } as const : undefined;
    const draft = createCareer('신인', 'infielder', 17, options);
    const first = playPeriod(chooseClub(draft, draft.offers[0]));
    const result = first.phase === 'moment' ? resolvePeriodMoment(first, 'contact') : first;

    assert.equal(result.phase, 'offseason');
    assert.equal(result.seasons.length, count);
    assert.ok(result.seasons.every((season) => season.period === 1));
    assert.equal(result.number, options?.number);
    assert.equal(result.bats, options?.bats);
  }
});

test('resuming a saved decisive moment preserves its period and shows overseas offers before another season', () => {
  const draft = createCareer('신인', 'infielder', 17, { mode: 'express', number: 17, bats: 'R' });
  const first = playPeriod(chooseClub(draft, draft.offers[0]));
  assert.equal(first.phase, 'moment');
  assert.equal(first.seasons.length, 1);

  const restored = JSON.parse(JSON.stringify(first)) as Career;
  const result = resolvePeriodMoment(restored, 'contact');
  assert.deepEqual(result, resolvePeriodMoment(first, 'contact'));
  assert.equal(result.seasons.length, 3);
  assert.equal(result.seasons[1].pa, (first.moment?.pending.pa ?? 0) + 1);
  assert.equal(result.momentResult, result.seasons[1].momentResult);
  assert.equal(resolvePeriodMoment(result, 'contact'), result);
  assert.ok(result.offers.some((id) => clubById.get(id)?.league === 'NPB'));

  const stayed = playPeriod(chooseClub(result, result.clubId));
  assert.equal(stayed.phase, 'offseason');
  assert.equal(stayed.seasons.length, 4);
  assert.equal(stayed.seasons[3].period, 4);
  assert.ok(stayed.offers.some((id) => clubById.get(id)?.league === 'NPB'));
});

test('new positions are saved directly and old archetypes map without changing saved skills', () => {
  for (const [position, label, archetype, strongestSkill] of [
    ['catcher', '포수', 'defense', 'defense'],
    ['infielder', '내야수', 'contact', 'contact'],
    ['outfielder', '외야수', 'power', 'power'],
  ] as const) {
    const rookie = createCareer('신인', position, 17);
    assert.equal(positionLabels[getPosition(rookie)], label);
    assert.equal(rookie.position, position);
    assert.equal(rookie.archetype, undefined);
    assert.equal(rookie.skills[strongestSkill], Math.max(...Object.values(rookie.skills)));

    const priorSkills = { contact: 48, power: 53, defense: 50 };
    const legacy = { ...rookie, position: undefined, archetype, skills: priorSkills };
    assert.equal(getPosition(legacy), position);
    const prepared = chooseClub(legacy, legacy.offers[0]);
    assert.equal(prepared.skills, priorSkills);
    const next = playPeriod(prepared);
    assert.equal(next.seasons.length, 1);
    assert.ok(next.skills[strongestSkill] > priorSkills[strongestSkill]);
  }

  for (const [position, family] of [
    ['firstBase', 'infielder'],
    ['secondBase', 'infielder'],
    ['thirdBase', 'infielder'],
    ['shortstop', 'infielder'],
    ['leftField', 'outfielder'],
    ['centerField', 'outfielder'],
    ['rightField', 'outfielder'],
  ] as const) {
    const rookie = createCareer('신인', position, 17);
    const restored = JSON.parse(JSON.stringify(rookie)) as Career;
    assert.equal(getPosition(restored), position);
    assert.deepEqual(restored.skills, createCareer('신인', family, 17).skills);
  }
});

test('old in-progress periods retain their pending at-bat and finish without another training choice', () => {
  const draft = createCareer('신인', 'infielder', 17, { mode: 'express', number: 17, bats: 'R' });
  const paused = playPeriod(chooseClub(draft, draft.offers[0]));
  assert.ok(paused.moment?.period);
  const legacy: Career = {
    ...paused,
    position: undefined,
    archetype: 'contact',
    moment: { ...paused.moment, period: { ...paused.moment.period, training: 'contact' } },
  };
  const restored = JSON.parse(JSON.stringify(legacy)) as Career;
  const result = resolvePeriodMoment(restored, 'contact');
  assert.equal(getPosition(result), 'infielder');
  assert.equal(result.seasons[1].pa, paused.moment.pending.pa + 1);
  assert.equal(result.seasons.length, 3);
  assert.equal(result.phase, 'offseason');
});

test('starters and relievers have distinct workloads and advance overseas without batting events', () => {
  const leaguesByRoute = [['KBO', 'NPB', 'MLB'], ['KBO', 'MLB']];
  for (const position of ['starter', 'reliever'] as const) {
    for (const [route, acceptNpb] of [true, false].entries()) {
      const draft = createCareer('신인 투수', position, 17, { mode: 'express', number: 17, bats: 'L' });
      assert.ok(isPitcherPosition(getPosition(draft)));
      assert.equal(draft.bats, undefined);
      let career = draft;
      for (let turn = 0; turn < 30 && career.phase !== 'retired'; turn += 1) {
        const mlb = career.offers.find((id) => clubById.get(id)?.league === 'MLB');
        const npb = acceptNpb && career.offers.find((id) => clubById.get(id)?.league === 'NPB');
        career = playPeriod(chooseClub(career, mlb || npb || career.offers[0]));
        assert.notEqual(career.phase, 'moment');
      }
      assert.equal(career.phase, 'retired');
      assert.equal(career.seasons.length, 22);
      assert.deepEqual([...new Set(career.seasons.map((season) => clubById.get(season.clubId)?.league))], leaguesByRoute[route]);
      for (const season of career.seasons) {
        assert.equal(season.pa, 0);
        const row = season.pitching;
        assert.ok(row && row.appearances > 0);
        assert.equal(row.starts, position === 'starter' ? row.appearances : 0);
        assert.ok(row.outs >= row.appearances && row.strikeouts <= row.outs);
        assert.ok(row.saves <= row.appearances - row.starts);
      }
      const total = pitchingTotals(career);
      assert.equal(total.outs, career.seasons.reduce((sum, season) => sum + (season.pitching?.outs ?? 0), 0));
      assert.deepEqual(pitchingTotals(JSON.parse(JSON.stringify(career)) as Career), total);
      if (position === 'reliever') assert.ok(total.saves > 0);
    }
  }
});

test('pitching lines count outs as thirds of an inning and hitters have no pitching records', () => {
  const hitter = completeCareer(true);
  assert.ok(!isPitcherPosition(getPosition(hitter)));
  assert.ok(hitter.seasons.every((season) => season.pitching === undefined));
  const empty = pitchingTotals(hitter);
  assert.deepEqual(pitchingLine(empty), { ip: '0.0', era: '0.00' });
  assert.deepEqual(pitchingLine({ ...empty, outs: 8, earnedRuns: 2 }), { ip: '2.2', era: '6.75' });
});
