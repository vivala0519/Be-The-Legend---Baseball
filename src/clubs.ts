export type League = 'KBO' | 'NPB' | 'MLB';

export type Club = { id: string; name: string; league: League; strength: number };

// Club names follow the official league directories. Strengths are game balance values.
const teams: Record<League, [id: string, name: string, strength: number][]> = {
  KBO: [
    ['lg', 'LG 트윈스', 77],
    ['hanwha', '한화 이글스', 74],
    ['ssg', 'SSG 랜더스', 70],
    ['samsung', '삼성 라이온즈', 72],
    ['nc', 'NC 다이노스', 64],
    ['kt', 'KT 위즈', 66],
    ['lotte', '롯데 자이언츠', 62],
    ['kia', 'KIA 타이거즈', 73],
    ['doosan', '두산 베어스', 60],
    ['kiwoom', '키움 히어로즈', 55],
  ],
  NPB: [
    ['hanshin', '한신 타이거스', 84],
    ['dena', '요코하마 DeNA 베이스타스', 78],
    ['yomiuri', '요미우리 자이언츠', 81],
    ['chunichi', '주니치 드래건스', 69],
    ['hiroshima', '히로시마 도요 카프', 72],
    ['yakult', '도쿄 야쿠르트 스왈로스', 74],
    ['softbank', '후쿠오카 소프트뱅크 호크스', 85],
    ['nipponham', '홋카이도 닛폰햄 파이터스', 80],
    ['orix', '오릭스 버펄로스', 78],
    ['rakuten', '도호쿠 라쿠텐 골든이글스', 71],
    ['seibu', '사이타마 세이부 라이온스', 68],
    ['chibalotte', '지바 롯데 마린스', 70],
  ],
  MLB: [
    ['bal', '볼티모어 오리올스', 82],
    ['bos', '보스턴 레드삭스', 85],
    ['nyy', '뉴욕 양키스', 92],
    ['tb', '탬파베이 레이스', 80],
    ['tor', '토론토 블루제이스', 88],
    ['cws', '시카고 화이트삭스', 75],
    ['cle', '클리블랜드 가디언스', 85],
    ['det', '디트로이트 타이거스', 83],
    ['kc', '캔자스시티 로열스', 80],
    ['min', '미네소타 트윈스', 81],
    ['ath', '애슬레틱스', 76],
    ['hou', '휴스턴 애스트로스', 86],
    ['laa', '로스앤젤레스 에인절스', 77],
    ['sea', '시애틀 매리너스', 87],
    ['tex', '텍사스 레인저스', 84],
    ['atl', '애틀랜타 브레이브스', 87],
    ['mia', '마이애미 말린스', 77],
    ['nym', '뉴욕 메츠', 88],
    ['phi', '필라델피아 필리스', 89],
    ['wsh', '워싱턴 내셔널스', 76],
    ['chc', '시카고 컵스', 86],
    ['cin', '신시내티 레즈', 80],
    ['mil', '밀워키 브루어스', 85],
    ['pit', '피츠버그 파이리츠', 78],
    ['stl', '세인트루이스 카디널스', 82],
    ['ari', '애리조나 다이아몬드백스', 84],
    ['col', '콜로라도 로키스', 75],
    ['lad', '로스앤젤레스 다저스', 94],
    ['sd', '샌디에이고 파드리스', 89],
    ['sf', '샌프란시스코 자이언츠', 83],
  ],
};

export const clubs: Club[] = (Object.keys(teams) as League[]).flatMap((league) =>
  teams[league].map(([id, name, strength]) => ({ id: `${league.toLowerCase()}-${id}`, name, league, strength })),
);
