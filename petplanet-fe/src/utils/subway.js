// 수도권 지하철 호선 공식 색상 & 표시명

export const LINES = [
  { code: '1', name: '1호선', short: '1', color: '#0052A4' },
  { code: '2', name: '2호선', short: '2', color: '#00A84D' },
  { code: '3', name: '3호선', short: '3', color: '#EF7C1C' },
  { code: '4', name: '4호선', short: '4', color: '#00A5DE' },
  { code: '5', name: '5호선', short: '5', color: '#996CAC' },
  { code: '6', name: '6호선', short: '6', color: '#CD7C2F' },
  { code: '7', name: '7호선', short: '7', color: '#747F00' },
  { code: '8', name: '8호선', short: '8', color: '#E6186C' },
  { code: '9', name: '9호선', short: '9', color: '#BDB092' },
  { code: 'SB', name: '신분당선', short: '신분당', color: '#D4003B' },
  { code: 'SU', name: '수인분당선', short: '수인분당', color: '#F5A200' },
  { code: 'GJ', name: '경의중앙선', short: '경의중앙', color: '#77C4A3' },
  { code: 'AR', name: '공항철도', short: '공항', color: '#0090D2' },
];

const BY_CODE = Object.fromEntries(LINES.map((l) => [l.code, l]));

export function lineInfo(code) {
  return BY_CODE[code] ?? { code, name: code, short: code, color: '#8d7d84' };
}
