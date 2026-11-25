# 09. 지하철 → 버스 · 지역별 탐색 (2026-11-25, BE2)

> 목포 · 무안처럼 지하철이 없는 지역에서도 "대중교통 접근성 기반"이라는 서비스 콘셉트가 살아 있도록
> 지하철역(stations)을 버리고 **버스 정류장 · 노선 · 실시간 도착**으로 바꿨어요.
> 탐색은 **[내 근처 | 지역별(시/도 → 시/군/구)]** 두 가지예요. 리뷰는 펫 플래닛 회원의 이용 인증 리뷰만 쓰고, 다른 사이트 후기는 **카카오맵 링크**로 보내요.

## 1. 바뀐 점 한눈에

| | 전 | 후 |
|---|---|---|
| 탐색 기준 | 지하철역 반경 · 내 위치 | **내 위치 반경(1·3·5km) · 지역(시도 → 시군구)** |
| 대중교통 | 가까운 지하철역 · 호선 | **가장 가까운 버스 정류장 · 지나가는 노선 · 실시간 도착 · 접근성 등급 A~D** |
| DB | `stations`, `place_stations` | `bus_stops`, `bus_routes`, `bus_route_stops` + `places`·`hospitals`·`pet_hotels` 에 `sido`, `sigungu`, `nearest_stop_id`, `nearest_stop_m`, `stops_500m` |
| API | `/stations`, `?stationId=`, `?lines=` | `/regions`, `/bus-stops/nearby`, `/bus-stops/{id}/routes`, `/bus-stops/{id}/arrivals`, `?sido=&sigungu=&nearStop=`, `sort=transit` |
| 응답 | `nearestStation`, `nearbyStations` | `sido`, `sigungu`, `busAccess` |
| 화면 | 노선도 · 역 선택 | 탐색 방법 탭 · 지역 선택 · 정류장 배지 · "버스로 가기" 패널 · 반려동물 버스 이용 안내 · 카카오맵 후기 링크 |

지하철 **콘셉트(노선 E·R·S·M, 단계 표시줄)** 는 버스 노선으로 읽어도 맞아서 디자인은 그대로 두고, 글자만 `NOW STATION → NEXT STOP` 처럼 바꿨어요.

## 2. 공공데이터

| 데이터 | 쓰는 곳 | 받는 법 | 상태 |
|---|---|---|---|
| 국토교통부 전국 버스정류장 위치정보 (data.go.kr/data/15067528) | `bus_stops` · 장소별 가장 가까운 정류장 | CSV 파일 (로그인 없이), 약 20만 행 | 적재기 `--bus-stops` 완료 |
| 국토교통부 버스노선별 경유정류장 (data.go.kr/data/15142031) | `bus_routes` · `bus_route_stops` (정류장을 지나는 노선) | Open API (자동승인, 개발계정 1,000건/일) | **활용 가이드 PDF 의 요청 형식 확인 후 적재기 `--bus-routes` 추가 예정**. 그전까지 노선 수는 0 → 등급은 "반경 500m 정류장 수"로 계산 |
| 국토교통부(TAGO) 버스도착정보 (data.go.kr/data/15098530) | 실시간 도착 (`/bus-stops/{id}/arrivals`) | Open API, 인증키는 서버에만 | 백엔드 완료. 키가 없으면 화면에 "준비 중" |

- 실시간 도착은 `cityCode`(도시코드) + 정류장 ID 로 조회해요. 정류장 CSV 의 `도시코드` 칼럼을 `bus_stops.city_code` 에 저장해요.
- 인증키는 **"일반 인증키(Decoding)"** 를 환경변수 `TAGO_SERVICE_KEY` 나 `backend/src/main/resources/application-local.yml` 의 `petplanet.tago.service-key` 에 넣어요. **커밋하지 마세요.**
- 같은 정류장은 30초 동안 다시 부르지 않고(서버 캐시), 버튼을 눌렀을 때만 불러서 일일 호출량을 아껴요.

## 3. DB (ERD 변경)

```
bus_stops (stop_id PK, name, latitude, longitude, city_code, city_name, collected_at)
bus_routes (route_id PK, route_no, route_name, sido, sigungu)
bus_route_stops (route_id FK, stop_seq, stop_id FK)  PK(route_id, stop_seq)   -- 노선 ↔ 정류장 N:M + 순서
places / hospitals / pet_hotels
  + sido, sigungu                 -- 주소 첫 두 단어 (전남 / 목포시), INDEX(sido, sigungu)
  + nearest_stop_id FK → bus_stops (ON DELETE SET NULL)
  + nearest_stop_m                -- 가장 가까운 정류장까지 직선거리(m)
  + stops_500m                    -- 반경 500m 안 정류장 수
```

- **왜 미리 계산해 두나**: 정류장이 20만 곳이라 목록을 볼 때마다 장소 × 정류장 거리를 계산하면 느려요. 적재기가 0.01° 격자로 정류장을 나눠 두고, 장소 1만 3천 곳의 가장 가까운 정류장을 몇 초 만에 계산해서 칼럼에 저장해요. 목록 SQL 은 `LEFT JOIN bus_stops` 한 번이면 돼요.
- **노선 수**: `(SELECT COUNT(DISTINCT route_id) FROM bus_route_stops WHERE stop_id = nearest_stop_id)` — 노선 데이터가 들어오면 자동으로 반영돼요.
- **지역 규칙** (`Region.parse` · `utils/region.js` · `patch_bus_transit.sql` · 적재기 모두 같음): 주소 첫 단어를 짧은 시/도 이름으로(`전라남도`·`전남` → `전남`), 둘째 단어가 시·군·구로 끝나면 시/군/구, 세종은 `세종시`.

실행 순서 (새 DB):
```bash
mysql -u root -p < db/schema_full.sql
mysql -u root -p < db/patch_v2_proposed.sql
mysql -u root -p < db/patch_be2_public_data.sql
mysql -u root -p < db/patch_bus_transit.sql      # 지하철 테이블 삭제 · 버스 테이블 · 지역/접근성 칼럼
mysql -u root -p < db/seed_dev_places.sql
mysql -u root -p < db/seed_demo.sql
cd db/loader && java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java \
  --hospital hospital.csv --hotel hotel.csv --kcisa kcisa.csv --places --bus-stops bus_stops.csv
```
이미 쓰던 DB(팀 서버 포함)는 `patch_bus_transit.sql` 만 실행하면 돼요. **팀 DB 반영은 팀원과 맞춘 뒤에.**

## 4. 대중교통 접근성 등급

| 점수 | 기준 |
|---|---|
| 거리 | 가장 가까운 정류장 200m 이내 3점 · 400m 이내 2점 · 800m 이내 1점 · 그 밖 0점 |
| +1점 | 그 정류장을 지나는 노선 5개 이상 (노선 정보가 없으면 반경 500m 정류장 4곳 이상) |
| 등급 | 4점 **A** 아주 가까워요 · 3점 **B** 버스로 가기 편해요 · 2점 **C** 조금 걸어요 · 그 아래 **D** 차량 이동 추천 |

도보 시간 = 거리 × 1.25(길 우회) ÷ 분당 75m(4.5km/h). 백엔드 `BusAccess`, 프론트 `utils/transit.js`, 적재기 dry-run 이 같은 규칙이에요.

## 5. API

| Method | Path | 설명 |
|---|---|---|
| GET | `/regions?type=place\|hospital\|hotel` | `[{ sido, count, sigungus: [{ name, count }] }]` — 데이터가 있는 지역만, 시/도는 표준 순서 |
| GET | `/places` · `/hospitals` · `/pet-hotels` | 공통 추가 파라미터: `sido`, `sigungu`, `nearStop=true`(정류장 300m 안). 장소는 `sort=transit`(정류장 가까운 순). `stationId` · `lines` 는 삭제 |
| GET | `/bus-stops/nearby?lat=&lng=&radiusM=500&limit=5` | 가까운 정류장 `[{ stopId, name, lat, lng, cityCode, cityName, distanceM, walkMin, routeCount }]` (반경 최대 1km) |
| GET | `/bus-stops/{stopId}/routes` | 지나가는 노선 `[{ routeId, routeNo, routeName }]` |
| GET | `/bus-stops/{stopId}/arrivals` | `{ stopId, stopName, status: OK\|NO_KEY\|NO_CITY\|UNAVAILABLE, message, fetchedAt, arrivals: [{ routeNo, routeType, minutes, remainingStops, lowFloor }] }` |

장소 · 병원 · 호텔 응답에 추가:
```jsonc
"sido": "전남", "sigungu": "목포시",
"busAccess": { "stopId": "…", "stopName": "목포역", "distanceM": 120, "walkMin": 2,
               "stops500m": 6, "routeCount": 0, "grade": "A", "gradeLabel": "버스 정류장이 아주 가까워요" }
// 적재기로 정류장을 계산하기 전이면 busAccess = null, 2km 안에 정류장이 없으면 stopId = null · grade = "D"
```

## 6. 반려동물 버스 이용 — 윤리 · 규정 검토

**규정**
- 시내버스 · 고속버스 약관은 **전용 운반상자(이동장)에 넣은 반려동물만** 승차를 허용하고, 어기면 승차를 거부할 수 있어요. 차 안에서 동물이 돌아다니게 해서 손해가 나면 배상 책임도 있어요. (서울 시내버스 운송사업 약관, 고속버스 운송약관, 국토교통부 시외버스 정책 Q&A)
- 휴대품 크기 · 무게 기준은 운수회사마다 달라요. 서울 시내버스는 휴대품을 20kg 미만 · 50×40×20cm 미만으로 안내해요.
- **장애인 보조견**은 이동장 규정과 별개로 대중교통 탑승을 **정당한 사유 없이 거부할 수 없어요** (장애인복지법 제40조, 위반 시 과태료).

**윤리적으로 신경 쓸 점과 화면에 넣은 것**

| 쟁점 | 화면에서 한 것 |
|---|---|
| "버스로 갈 수 있다"를 약속처럼 보이면 대형견 보호자가 정류장에서 거절당할 수 있어요 | 등급 이름을 "대중교통 **접근성**"으로 하고, 반려동물 탑승 가능 여부는 따로 안내 · "기사 판단 · 약관이 우선" 문구 |
| 체중별로 현실이 달라요 | 등록한 반려동물 체중으로 안내: **5kg 이하** 이동장에 넣으면 가능 · **10kg 이하** 이동장 포함 크기 · 무게 확인 필요 · **10kg 초과** 버스 대신 자가용 · 펫택시 추천 (펫 플래닛 참고 기준) |
| 다른 승객(알레르기 · 공포 · 위생) | 이용 수칙: 이동장 문 닫고 무릎 · 발밑, 혼잡 시간 피하기, 배변 패드 · 탈취제, 불편한 승객이 있으면 자리 옮기기 |
| 동물 복지 (오랜 시간 이동장) | 도보 · 버스 · 자동차 · 택시 예상 시간을 같이 보여 줘서 덜 힘든 방법을 고를 수 있게 |
| 장애인 보조견 차별 방지 | 이동장 규정과 별개라는 안내를 항상 같이 표시 |
| 비제휴 병원의 "리뷰 0개"가 실제 평판처럼 보임 | 0점 대신 "제휴 병원이 아니라 이용 인증 리뷰가 없어요" + 카카오맵 후기 링크 |

## 7. 카카오맵 후기 링크 · 위치정보 — 법적 검토 (법률 자문 아님)

- **리뷰를 가져오지 않는 이유**: 카카오는 장소 리뷰를 API 로 주지 않고, 제휴 · 비영리도 예외가 없다고 안내해요. 화면을 긁어 오는 크롤링은 약관 위반이라 하지 않아요. 네이버도 리뷰 API 가 없어요.
- **링크만 거는 방식**: 카카오맵 URL 규칙의 검색 링크(`https://map.kakao.com/link/search/{시군구 장소명}`)를 새 탭으로 열어요. 후기 본문을 복사 · 저장 · 프레임(iframe)으로 넣지 않고, 카카오 로고도 쓰지 않아요. 대법원 2021. 9. 9. 선고 2017도19025 전원합의체 판결은 **저작권을 침해한 게시물로의 링크**를 방조로 본 것이고, 링크 자체는 전송에 해당하지 않는다고 했어요. 카카오맵의 정식 장소 페이지로 보내는 링크는 여기에 해당하지 않아요.
- **공공데이터**: 사용한 데이터는 모두 "이용허락범위 제한 없음"이지만, 출처는 화면 하단에 표시해요.
- **위치정보**: 내 위치 좌표는 이번 검색에만 쓰고 서버에 저장하거나 로그로 남기지 않아요(브라우저에 마지막 출발점만 기억). 다만 서버로 좌표를 보내 결과를 주는 서비스를 **실제로 운영**하면, 저장하지 않더라도 위치정보법상 위치기반서비스사업 신고 대상이에요(소상공인 · 1인 창조기업은 간소화). 수업 프로젝트로 시연하는 범위에서는 사업이 아니지만, 출시한다면 신고 · 위치정보 이용약관 · 동의 절차가 필요해요.
- **구글 리뷰**(검토만 함): Places API 로 장소당 최대 5개를 받을 수 있지만, 저장 금지(place_id 만 가능) · 출처 표기 · 구글이 아닌 지도와 함께 쓰는 것에 대한 제한 조항이 있어서 이번에는 쓰지 않았어요.

## 8. 남은 일

1. 버스노선별 경유정류장 API 의 요청 형식(활용 가이드 PDF) 확인 → 적재기 `--bus-routes` 추가 → 노선 수 · 노선 칩 · 등급 보너스 반영
2. 정류장 CSV 의 `정류장번호` 가 TAGO 실시간 도착 API 의 `nodeId` 와 같은 형식인지 실제 파일로 확인 (다르면 매핑 칼럼 추가)
3. 정류장 CSV 에 서울이 들어 있는지 확인 (없으면 서울 시연 장소는 등급 D → 서울시 버스정류소 위치정보를 같이 적재)
4. 팀 DB 에 `patch_bus_transit.sql` 반영 (팀원 동의 후)
