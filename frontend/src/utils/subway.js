// 호선·역 이름 표시 규칙 — DB stations 테이블 값을 그대로 씁니다.
//  - line: 공공데이터 표기 그대로 '2호선', '신분당선' …
//  - name: '강남' 또는 '강남역' 어느 쪽으로 저장돼도 화면에는 항상 '강남역'으로 보이게 처리
// 목업 색 규칙상 호선 공식 색은 쓰지 않아요.
export const MAIN_LINES = ['1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선'];
export const EXTRA_LINES = ['신분당선', '수인분당선', '경의중앙선', '공항철도']; // "전체 노선 보기"
export const DEFAULT_LINE = '2호선';

export const lineName = (line) => line;

/** '강남역' → '강남' */
export const stationBase = (name = '') => name.replace(/역$/, '');
/** '강남' / '강남역' → '강남역' */
export const stationLabel = (name = '') => `${stationBase(name)}역`;
