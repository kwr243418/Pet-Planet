// 개발용 시드 데이터 (Day 3 "개발용 시드 데이터 연동")
// ⚠️ 장소/사용자/리뷰는 모두 가상의 데이터입니다. 실제 공공데이터 적재 후에는 VITE_USE_MOCK=false 로 전환하세요.
// 지하철역 좌표는 실제 위치 근사값입니다. (stations 테이블: 역 1행 = 역이름 + 호선 1개)

import { offsetMeters } from '../utils/geo.js';

const S = (name, lines, lat, lng) => ({ name, lines, lat, lng });

const STATION_DEFS = [
  S('강남', ['2', 'SB'], 37.4979, 127.0276),
  S('역삼', ['2'], 37.5006, 127.0364),
  S('신논현', ['9', 'SB'], 37.5045, 127.025),
  S('신사', ['3', 'SB'], 37.5163, 127.0203),
  S('압구정', ['3'], 37.527, 127.0284),
  S('홍대입구', ['2', 'GJ', 'AR'], 37.5572, 126.9245),
  S('합정', ['2', '6'], 37.5496, 126.9139),
  S('상수', ['6'], 37.5477, 126.9229),
  S('망원', ['6'], 37.556, 126.9101),
  S('성수', ['2'], 37.5446, 127.0559),
  S('뚝섬', ['2'], 37.5474, 127.0474),
  S('서울숲', ['SU'], 37.5435, 127.0446),
  S('이태원', ['6'], 37.5345, 126.9946),
  S('한강진', ['6'], 37.5397, 127.0018),
  S('잠실', ['2', '8'], 37.5133, 127.1001),
  S('석촌', ['8', '9'], 37.5054, 127.1069),
  S('서울역', ['1', '4', 'AR', 'GJ'], 37.5547, 126.9707),
  S('을지로3가', ['2', '3'], 37.5663, 126.991),
  S('광화문', ['5'], 37.571, 126.9768),
  S('경복궁', ['3'], 37.5759, 126.9735),
  S('여의도', ['5', '9'], 37.5216, 126.9242),
];

export const STATIONS = (() => {
  const rows = [];
  let id = 1;
  for (const s of STATION_DEFS) {
    for (const line of s.lines) {
      rows.push({ stationId: id++, stationName: s.name, line, lat: s.lat, lng: s.lng });
    }
  }
  return rows;
})();

export const PLACE_CATEGORIES = [
  { categoryId: 1, name: '카페' },
  { categoryId: 2, name: '식당' },
  { categoryId: 3, name: '숙소' },
  { categoryId: 4, name: '공원·야외' },
  { categoryId: 5, name: '문화시설' },
];

const STATION_COORD = Object.fromEntries(STATION_DEFS.map((s) => [s.name, s]));

// [이름, 카테고리, 기준역, 동쪽(m), 북쪽(m), 동반가능크기, 실내외, 설명, 주소]
const PLACE_DEFS = [
  ['멍멍살롱 카페', 1, '강남', 300, 200, 'MEDIUM', 'BOTH', '루프탑 테라스가 있는 애견 동반 카페예요. 수제 펫 케이크와 퍼푸치노가 인기 메뉴!', '서울 강남구 테헤란로1길 12'],
  ['꼬리치는 브런치', 2, '강남', -350, 420, 'MEDIUM', 'INDOOR', '강아지 전용 의자와 물그릇이 준비된 브런치 레스토랑. 펫 메뉴 3종 운영.', '서울 강남구 강남대로 98길 7'],
  ['포포 펫라운지', 1, '역삼', 200, -250, 'LARGE', 'BOTH', '대형견도 마음껏! 120평 실내 놀이터와 카페가 함께 있어요.', '서울 강남구 역삼로 22길 5'],
  ['신논현 댕댕식당', 2, '신논현', -150, 150, 'SMALL', 'INDOOR', '소형견 동반 가능한 한식 백반집. 무염 강아지 수육 메뉴가 있어요.', '서울 강남구 봉은사로 4길 18'],
  ['가로수길 퍼피하우스', 1, '신사', 400, 300, 'SMALL', 'INDOOR', '포근한 쿠션 좌석과 포토존이 있는 감성 카페.', '서울 강남구 가로수길 31'],
  ['압구정 펫스테이', 3, '압구정', -300, 350, 'MEDIUM', 'INDOOR', '반려견과 함께 묵는 부티크 호텔. 전용 침대·배변패드·어메니티 제공.', '서울 강남구 압구정로 30길 9'],
  ['도산 산책숲', 4, '압구정', 500, -600, 'LARGE', 'OUTDOOR', '나무 그늘이 많은 산책 코스. 리드줄 착용 필수, 배변봉투함 비치.', '서울 강남구 도산대로 45길'],
  ['연남 꾹꾹이 카페', 1, '홍대입구', 250, 450, 'SMALL', 'BOTH', '경의선숲길 바로 앞, 산책 후 들르기 좋은 작은 카페.', '서울 마포구 성미산로 17길 21'],
  ['홍대 바우와우 펍', 2, '홍대입구', -300, -200, 'MEDIUM', 'BOTH', '저녁엔 펍, 낮엔 버거집. 테라스석은 중형견까지 동반 가능.', '서울 마포구 어울마당로 64'],
  ['합정 리버뷰 테라스', 1, '합정', -200, -350, 'LARGE', 'OUTDOOR', '한강이 보이는 야외 테라스 전용 동반석이 있어요.', '서울 마포구 토정로 3길 12'],
  ['상수 꼬순내 베이커리', 1, '상수', 150, 100, 'SMALL', 'INDOOR', '사람 빵과 강아지 빵을 같이 굽는 베이커리 카페.', '서울 마포구 와우산로 11길 4'],
  ['망원 한강 피크닉존', 4, '망원', -250, -700, 'LARGE', 'OUTDOOR', '넓은 잔디밭과 반려견 음수대가 있는 한강공원 구역.', '서울 마포구 마포나루길 467'],
  ['망원 동네식탁', 2, '망원', 200, 150, 'MEDIUM', 'INDOOR', '망원시장 근처 가정식 식당. 강아지 간식 서비스!', '서울 마포구 포은로 8길 15'],
  ['홍대 펫 갤러리', 5, '홍대입구', 100, -400, 'SMALL', 'INDOOR', '반려동물 작가 전시가 열리는 작은 갤러리. 유모차 입장 권장.', '서울 마포구 홍익로 5길 30'],
  ['성수 멍스테이', 3, '성수', 300, 200, 'MEDIUM', 'INDOOR', '공장을 개조한 감성 스테이. 개별 마당이 있는 객실 운영.', '서울 성동구 성수이로 20길 3'],
  ['서울숲 댕댕 놀이터', 4, '서울숲', -200, 500, 'LARGE', 'OUTDOOR', '소형/대형 구역이 나뉜 반려견 놀이터. 동물등록증 확인 후 입장.', '서울 성동구 뚝섬로 273'],
  ['뚝섬 하얀꼬리 카페', 1, '뚝섬', 150, -200, 'MEDIUM', 'BOTH', '하얀 인테리어의 2층 카페. 2층 전체가 동반석이에요.', '서울 성동구 서울숲2길 18'],
  ['성수 공장 브루어리', 2, '성수', -400, 150, 'LARGE', 'BOTH', '넓은 창고형 펍. 대형견도 함께 앉을 수 있는 대형 테이블.', '서울 성동구 연무장길 41'],
  ['성수 플레이 아트룸', 5, '성수', 100, -350, 'MEDIUM', 'INDOOR', '반려견과 함께 체험하는 미디어아트 전시관.', '서울 성동구 아차산로 17길 8'],
  ['한남 퍼피 테이블', 2, '한강진', 200, 250, 'MEDIUM', 'BOTH', '파스타와 펫 스테이크가 있는 이탈리안 레스토랑.', '서울 용산구 대사관로 5길 11'],
  ['이태원 루프탑 멍카페', 1, '이태원', -150, 200, 'LARGE', 'BOTH', '남산뷰 루프탑. 대형견 전용 그늘막 좌석 운영.', '서울 용산구 이태원로 27가길 22'],
  ['한남 펫 북스', 5, '한강진', -300, -150, 'SMALL', 'INDOOR', '반려동물 책만 모은 독립서점. 안고 입장 가능.', '서울 용산구 한남대로 20길 6'],
  ['송리단길 젤리 카페', 1, '석촌', -300, 300, 'SMALL', 'INDOOR', '젤리 모양 디저트로 유명한 아기자기한 카페.', '서울 송파구 백제고분로 45길 14'],
  ['석촌호수 산책로', 4, '잠실', 200, -300, 'LARGE', 'OUTDOOR', '호수를 한 바퀴 도는 2.5km 산책 코스. 벚꽃 시즌 강추!', '서울 송파구 잠실로 148'],
  ['잠실 패밀리 펫호텔', 3, '잠실', -400, -200, 'LARGE', 'INDOOR', '대형견 객실 보유. 체크인 시 접종 기록 확인.', '서울 송파구 올림픽로 35길 10'],
  ['송파 멍구이 식당', 2, '석촌', 300, -150, 'MEDIUM', 'BOTH', '고기 굽는 냄새에 신나는 아이들! 펫 전용 무염 고기 제공.', '서울 송파구 석촌호수로 12길 5'],
  ['을지로 레트로 펍', 2, '을지로3가', 150, -150, 'SMALL', 'INDOOR', '노포 감성의 소형견 동반 호프집.', '서울 중구 을지로 13길 7'],
  ['서울로 산책 카페', 1, '서울역', -250, 200, 'MEDIUM', 'BOTH', '서울로7017 산책 후 쉬어가기 좋은 테라스 카페.', '서울 중구 청파로 432'],
  ['서촌 한옥 댕스테이', 3, '경복궁', -350, 250, 'SMALL', 'INDOOR', '마당 있는 한옥 독채. 소형견 2마리까지 동반 가능.', '서울 종로구 자하문로 7길 19'],
  ['광화문 펫 미술관', 5, '광화문', 200, 200, 'MEDIUM', 'INDOOR', '반려견 동반 관람일(매주 토요일)을 운영하는 미술관.', '서울 종로구 새문안로 3길 30'],
  ['여의도 한강 잔디마당', 4, '여의도', 500, -400, 'LARGE', 'OUTDOOR', '드넓은 잔디마당과 반려견 놀이 구역.', '서울 영등포구 여의동로 330'],
  ['여의도 퍼피 브런치', 2, '여의도', -200, 300, 'MEDIUM', 'INDOOR', '직장인도 반려견도 좋아하는 브런치 맛집.', '서울 영등포구 국제금융로 6길 15'],
];

export const PLACES = PLACE_DEFS.map(([name, categoryId, st, dx, dy, maxSize, indoorType, description, address], i) => {
  const base = STATION_COORD[st];
  const { lat, lng } = offsetMeters(base.lat, base.lng, dx, dy);
  return {
    placeId: i + 1,
    categoryId,
    name,
    address,
    phone: `02-${String(3100 + i * 37).padStart(4, '0')}-${String(1000 + i * 211).slice(-4)}`,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    description,
    maxSize,
    indoorType,
  };
});

export const SEED_USERS = [
  { userId: 1, email: 'demo@petplanet.kr', password: 'petplanet123!', name: '김펫플', role: 'USER', createdAt: '2026-11-02T10:00:00+09:00' },
  { userId: 2, email: 'daeng@example.com', password: 'x', name: '박댕댕', role: 'USER', createdAt: '2026-10-01T10:00:00+09:00' },
  { userId: 3, email: 'kkori@example.com', password: 'x', name: '정꼬리', role: 'USER', createdAt: '2026-10-03T10:00:00+09:00' },
  { userId: 4, email: 'mung@example.com', password: 'x', name: '최멍멍', role: 'USER', createdAt: '2026-10-05T10:00:00+09:00' },
  { userId: 5, email: 'baduk@example.com', password: 'x', name: '한바둑', role: 'USER', createdAt: '2026-10-09T10:00:00+09:00' },
];

export const SEED_PETS = [
  { petId: 1, userId: 1, name: '콩이', breed: '말티즈', weight: 3.8, gender: 'F', neutered: true },
  { petId: 2, userId: 2, name: '보리', breed: '골든 리트리버', weight: 28.5, gender: 'M', neutered: true },
  { petId: 3, userId: 3, name: '두부', breed: '비숑 프리제', weight: 6.2, gender: 'M', neutered: false },
  { petId: 4, userId: 4, name: '라떼', breed: '웰시코기', weight: 12.4, gender: 'F', neutered: true },
  { petId: 5, userId: 5, name: '바둑이', breed: '믹스', weight: 9.1, gender: 'M', neutered: true },
];

const REVIEW_LINES = [
  [5, '직원분들이 강아지를 너무 예뻐해 주셔서 감동했어요. 물그릇도 바로 챙겨주셨어요!'],
  [5, '역에서 가까워서 지하철 타고 가기 정말 편했어요. 다음에 또 올게요 🐶'],
  [4, '분위기 좋고 공간도 넓어요. 주말엔 사람이 많아서 조금 기다렸어요.'],
  [4, '펫 메뉴가 생각보다 다양해서 좋았어요. 가격은 살짝 있는 편이에요.'],
  [3, '괜찮았는데 동반석이 좀 좁았어요. 소형견이면 무난할 것 같아요.'],
  [5, '산책 코스로 최고예요! 그늘도 많고 배변봉투도 비치되어 있어요.'],
  [4, '사진 찍기 좋은 포토존이 많아요. 우리 아이 인생샷 건졌어요 📸'],
  [2, '동반 가능하다고 해서 갔는데 실내는 안 된다고 하셔서 아쉬웠어요.'],
  [5, '대형견도 눈치 안 보고 갈 수 있는 곳이라 너무 소중해요.'],
  [4, '깨끗하고 쾌적해요. 강아지 간식 서비스도 주셨어요!'],
  [3, '음식은 맛있었는데 주차가 어려워요. 지하철 추천합니다.'],
  [5, '재방문 의사 100%! 사장님도 강아지를 키우셔서 배려가 남달라요.'],
];

export const SEED_REVIEWS = (() => {
  const rows = [];
  let id = 1;
  const base = new Date('2026-11-14T12:00:00+09:00').getTime();
  for (const p of PLACES) {
    const count = 2 + ((p.placeId * 7) % 4); // 2~5개
    for (let k = 0; k < count; k++) {
      const [rating, content] = REVIEW_LINES[(p.placeId * 5 + k * 3) % REVIEW_LINES.length];
      const userId = 2 + ((p.placeId + k) % 4);
      const createdAt = new Date(base - (p.placeId * 13 + k * 29) * 3600_000).toISOString();
      rows.push({ reviewId: id++, userId, targetType: 'PLACE', targetId: p.placeId, rating, content, createdAt, updatedAt: createdAt });
    }
  }
  return rows;
})();

export const SEED_BOOKMARKS = [
  { bookmarkId: 1, userId: 1, placeId: 1, createdAt: '2026-11-10T09:00:00+09:00' },
  { bookmarkId: 2, userId: 1, placeId: 8, createdAt: '2026-11-11T09:00:00+09:00' },
  { bookmarkId: 3, userId: 1, placeId: 16, createdAt: '2026-11-12T09:00:00+09:00' },
];
