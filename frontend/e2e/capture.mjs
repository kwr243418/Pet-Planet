// 발표용 화면 캡처 (3주차 Day 14)
// FE1 화면을 PC(1440)·모바일(390) 크기로 찍어서 docs/screenshots/ 에 저장해요.
// 실제 폰트(Gothic A1·Jost·Bagel Fat One)가 보이도록 인터넷이 되는 내 컴퓨터에서 실행하세요.
//
//   1) 처음 한 번: npx playwright install chromium
//   2) 터미널 1: npm run dev     (VITE_USE_MOCK=true — 데모 데이터로 찍혀요)
//   3) 터미널 2: npm run capture
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url)); // 윈도우·한글 경로도 OK
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  // [파일 이름, 경로, 로그인 필요, 찍기 전 동작]
  ['s00-intro', '/', false],
  ['s01-home', '/home', false],
  ['s02-explore', '/explore?mode=region&sido=%EC%84%9C%EC%9A%B8&sigungu=%EB%A7%88%ED%8F%AC%EA%B5%AC', false],
  ['s02-explore-me', '/explore?mode=me&lat=37.5572&lng=126.9245&from=%ED%99%8D%EB%8C%80%EC%9E%85%EA%B5%AC&r=1', false],
  ['s02-explore-filter', '/explore?mode=region&sido=%EC%84%9C%EC%9A%B8&cat=1&sizes=SMALL&near=1', false],
  ['s03-place-detail', '/places/1', true],
  ['s03-review-modal', '/places/3', true, async (p) => {
    await p.getByRole('button', { name: '리뷰 쓰기' }).click();
    await p.getByRole('radio', { name: '5점' }).click();
    await p.locator('textarea').fill('정류장에서 가까워서 버스 타고 오기 편해요. 실내 좌석도 넓어요!');
  }],
  ['s08-mypage', '/mypage', true],
  ['s09-signup', '/signup', false],
  ['login', '/login', false],
  ['pet-edit', '/pets/2/edit', true],
];

const browser = await chromium.launch();
for (const [device, viewport, scale] of [
  ['pc', { width: 1440, height: 900 }, 1],
  ['mobile', { width: 390, height: 844 }, 2],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('pp-region', JSON.stringify({ sido: '서울', sigungu: '마포구' }));
  });
  let loggedIn = false;
  for (const [name, path, needLogin, before] of SHOTS) {
    if (needLogin && !loggedIn) {
      await page.goto(`${BASE}/login`);
      await page.getByLabel('이메일 (아이디)').fill('demo@petplanet.kr');
      await page.getByLabel('비밀번호', { exact: true }).fill('petplanet123!');
      await page.locator('form button[type=submit]').click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      loggedIn = true;
    }
    if (!needLogin && loggedIn && ['/signup', '/login'].includes(path)) {
      await page.evaluate(() => localStorage.removeItem('pp-access-token'));
      loggedIn = false;
    }
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    if (before) await before(page), await page.waitForTimeout(500);
    const file = `${OUT}${device}-${name}.png`;
    await page.screenshot({ path: file, fullPage: !before });
    console.log('📸', `${device}-${name}.png`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\n저장 위치: ${OUT}`);
