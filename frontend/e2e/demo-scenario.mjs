// 시연 시나리오 자동 점검 (3주차 Day 13)
// 최종 시연 Step 1·2·5(FE1 부분)를 브라우저로 그대로 따라가며 확인해요.
//
// 사용법
//   1) 처음 한 번: npx playwright install chromium
//   2) 터미널 1: npm run dev            (목 서버 모드 VITE_USE_MOCK=true 권장)
//   3) 터미널 2: npm run test:e2e
//   다른 주소: BASE_URL=http://localhost:4173 npm run test:e2e   ·   창 띄워 보기: HEADED=1 npm run test:e2e
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const results = [];
const check = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const step = (title) => console.log(`\n── ${title}`);

const browser = await chromium.launch({ headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
// 카카오맵은 키·도메인 설정에 따라 달라서 막고, 미리보기 지도로 점검
await ctx.route(/dapi\.kakao\.com/, (r) => r.abort());
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const wait = (ms = 700) => page.waitForTimeout(ms);
const email = `demo${Date.now() % 100000}@petplanet.kr`;

try {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());

  step('Step 1 · 회원가입 & 로그인 (S09 → S01)');
  await page.goto(`${BASE}/signup`);
  await page.getByRole('button', { name: /가입하고 출발하기/ }).click();
  await wait(400);
  check(await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid') === 'true'), '빈 칸으로 제출 → 첫 오류 칸으로 이동');
  await page.getByLabel('이메일 (아이디)').fill(email);
  await page.getByRole('button', { name: '중복 확인' }).click();
  await wait();
  check(await page.getByText('사용할 수 있는 이메일이에요').isVisible(), '이메일 중복 확인');
  await page.getByLabel('비밀번호', { exact: true }).fill('abc');
  check((await page.locator('.pw-rules li.is-ok').count()) === 1, '비밀번호 조건 체크리스트 (영문만 충족)');
  await page.getByLabel('비밀번호', { exact: true }).fill('petplanet123!');
  check((await page.locator('.pw-rules li.is-ok').count()) === 4, '비밀번호 조건 4개 모두 충족');
  await page.getByLabel('비밀번호 확인').fill('petplanet123!');
  await page.getByLabel('이름', { exact: true }).first().fill('시연회원');
  await page.locator('#pet0-name').fill('보리');
  await page.locator('#pet0-breed').fill('진돗개');
  await page.locator('#pet0-weight').fill('18.55kg');
  check((await page.locator('#pet0-weight').inputValue()) === '18.5', '체중 입력 정리 (18.55kg → 18.5)');
  await page.locator('#pet0-weight').fill('18');
  await page.getByRole('radio', { name: '수컷' }).click();
  await page.getByRole('radio', { name: '완료' }).click();
  await page.getByRole('button', { name: /가입하고 출발하기/ }).click();
  await wait(1500);
  check(new URL(page.url()).pathname === '/home', '가입 후 홈(/home)으로 환승');
  check(await page.getByText('시연회원 님').isVisible(), '헤더에 로그인 상태');
  check((await page.locator('.pet-ticket b').first().innerText()) === '보리', '홈 체중 배너에 내 반려동물(보리 18kg)');
  check((await page.locator('.room-row.is-no').count()) === 1, '18kg → 미디엄 룸(15kg) 입실 불가 표시');

  step('Step 2 · 지하철역 & 장소 탐색 (S01 → S02 → S03)');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.getByRole('link', { name: /우리 역 주변 찾기/ }).click();
  await wait(1500);
  check((await page.evaluate(() => window.scrollY)) === 0, '화면 이동 시 맨 위부터');
  check((await page.locator('.line-diagram__stop.is-selected').innerText()) === '홍대입구', '기본 역: 2호선 홍대입구');
  check((await page.title()).includes('홍대입구역'), '탭 제목에 역 이름', await page.title());
  const total = Number(await page.locator('.results__count b').innerText());
  await page.getByRole('button', { name: '카페', exact: true }).click();
  await wait(1000);
  const cafes = Number(await page.locator('.results__count b').innerText());
  check(cafes > 0 && cafes < total, `카테고리 필터 (전체 ${total} → 카페 ${cafes})`);
  await page.getByRole('button', { name: '소형', exact: true }).click();
  await wait(1000);
  check((await page.locator('.place-card').count()) > 0, '크기 필터(소형) 결과 있음');
  await page.locator('.fmap-pin').first().click();
  await wait(400);
  check((await page.locator('.place-card.is-selected').count()) === 1, '지도 핀 → 같은 번호 카드 강조');
  await page.locator('.place-card a').first().click();
  await wait(1500);
  check((await page.locator('.crumb').innerText()).replace(/\s+/g, ' ').includes('2호선 › 홍대입구 › 카페'), '경로: 호선 › 역 › 카테고리');
  await page.getByRole('button', { name: '관심 장소 찜하기' }).click();
  await wait(900);
  check(await page.getByRole('button', { name: '찜한 장소예요' }).isVisible(), '관심 장소 찜');
  check((await page.locator('.now-station__stop.is-current').innerText()) === '관심 장소 찜', 'NOW STATION 마지막 단계');

  step('Step 5 · 통합 리뷰 & 별점 (S03 → S08)');
  const before = Number((await page.locator('.detail-hero__rating .muted').innerText()).replace(/\D/g, ''));
  await page.getByRole('button', { name: '리뷰 쓰기' }).click();
  await wait(400);
  await page.getByRole('button', { name: '리뷰 등록' }).click();
  await wait(300);
  check(await page.getByText('별점을 선택해 주세요.').isVisible(), '별점 없이 등록 → 오류');
  await page.locator('textarea').fill('작성 중');
  await page.getByRole('button', { name: '취소' }).click();
  await wait(300);
  check(await page.getByText('작성 중인 리뷰가 있어요').isVisible(), '작성 중 닫기 → 확인창');
  await page.getByRole('alertdialog').getByRole('button', { name: '취소' }).click();
  await page.getByRole('radio', { name: '5점' }).click();
  await page.locator('textarea').fill('역에서 가까워서 시연 때도 쉽게 찾아갔어요!');
  await page.getByRole('button', { name: '리뷰 등록' }).click();
  await wait(1200);
  const after = Number((await page.locator('.detail-hero__rating .muted').innerText()).replace(/\D/g, ''));
  check(after === before + 1, `리뷰 수 바로 반영 (${before} → ${after})`);
  check((await page.locator('.review-card').filter({ hasText: '내 리뷰' }).count()) === 1, '내 리뷰에만 수정·삭제');
  await page.goto(`${BASE}/mypage`);
  await wait(1500);
  const tiles = await page.locator('.summary-tile__value').allInnerTexts();
  check(tiles[2] === '1' && tiles[3] === '1', `마이페이지 요약 (리뷰 ${tiles[2]} · 찜 ${tiles[3]})`);
  check((await page.locator('#reviews .mini-row').count()) === 1, '작성한 리뷰 목록');

  step('예외 처리');
  await page.goto(`${BASE}/places/99999`);
  await wait(1200);
  check(await page.getByText('다른 장소 둘러보기').isVisible(), '없는 장소 → 안내 + 다른 장소 링크');
  await page.goto(`${BASE}/no-such-page`);
  await wait(500);
  check(await page.getByText('없는 역이에요').isVisible(), '없는 주소 → 404 화면');
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await wait(200);
  check(await page.getByText('인터넷 연결이 끊겼어요').isVisible(), '오프라인 안내 띠');
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  check(pageErrors.length === 0, '화면 오류(콘솔 예외) 없음', pageErrors.join(' / '));
} catch (e) {
  check(false, '시나리오 진행 중 멈춤', e.message.split('\n')[0]);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n결과: ${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
