import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 펫플래닛 공공데이터 적재기 (BE2) — 동물병원 · 펫호텔(동물위탁관리업) · 반려동물 동반 장소
 *
 * 1) 행정안전부 인허가 CSV에서 "영업/정상" 업체만 골라
 * 2) 좌표를 EPSG:5174(보정계수 없는 Bessel 중부원점 TM) → WGS84 위도·경도(카카오맵 좌표)로 바꾸고
 * 3) 병원은 한국문화정보원 '반려동물 동반 가능 문화시설' CSV에 같은 업체가 있으면
 *    영업시간·휴무일을 operating_hours 한 칸에 "월~금 10:00~20:00 / 휴무: 매주 일요일" 처럼 합쳐 넣고
 * 4) hospitals / pet_hotels 테이블에 저장해요. 다시 실행해도 중복 없이 갱신돼요 (license_no = 관리번호 기준 UPSERT).
 *    호텔은 영업시간을 저장하지 않아요.
 *
 * 실행 (Java 11+, MySQL JDBC 드라이버 jar 필요):
 *   java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java \
 *        --hospital 동물병원.csv --hotel 동물위탁관리업.csv --kcisa 한국문화정보원.csv
 *   → DB 주소 · 포트 · DB 이름 · 아이디 · 비밀번호를 물어봐요.
 *
 * 옵션:
 *   --host --port --db --user           접속 정보를 미리 줄 때 (비밀번호는 항상 입력 받음)
 *   --dry-run                           DB 없이 변환·매칭 결과만 출력
 *   --sql-out 파일.sql                   DB 대신 INSERT 문을 파일로 저장 (Workbench 등으로 실행)
 *   --places                            --kcisa 파일의 "동반 가능(Y)" 카페·식당·숙소·여행지·문화시설을 places 에도 저장
 *                                       (주변 탐색용. 약국·병원·용품·미용·위탁은 장소가 아니라 넣지 않아요)
 *     예) java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --kcisa kcisa.csv --places
 *   --bus-stops 정류장.csv               국토교통부 전국 버스정류장 위치정보 → bus_stops (2026-11-25, 지하철 대신 버스)
 *   --access                            places · hospitals · pet_hotels 의 지역(sido · sigungu)과 가장 가까운 정류장 ·
 *                                       반경 500m 정류장 수를 다시 계산 (--bus-stops · 장소 · 병원 · 호텔을 넣으면 자동으로 해요)
 *     예) java -cp mysql-connector-j-9.1.0.jar PublicDataLoader.java --bus-stops bus_stops.csv
 */
public class PublicDataLoader {

    // ------------------------------------------------------------------ 설정
    static final String OPEN_STATUS = "영업/정상";
    static final double MATCH_NAME_M = 150;   // 이름이 같으면 이 거리 안이면 같은 업체
    static final double MATCH_ADDR_M = 300;   // 도로명주소가 같고 이름이 서로 포함되면 이 거리 안
    static final int BATCH = 500;

    static final Set<String> KCISA_HOSPITAL_CATS = Set.of("동물병원");

    // ------------------------------------------------------------------ main
    public static void main(String[] argv) throws Exception {
        Map<String, String> a = parseArgs(argv);
        String hospitalCsv = a.get("hospital"), hotelCsv = a.get("hotel"), kcisaCsv = a.get("kcisa"), stopsCsv = a.get("bus-stops");
        boolean withPlaces = a.containsKey("places"), withAccess = a.containsKey("access");
        if ((hospitalCsv == null && hotelCsv == null && !withPlaces && stopsCsv == null && !withAccess) || (withPlaces && kcisaCsv == null)) {
            System.err.println("사용법: java -cp <mysql-connector-j.jar> PublicDataLoader.java "
                    + "[--hospital <동물병원.csv>] [--hotel <동물위탁관리업.csv>] [--kcisa <한국문화정보원.csv> [--places]] "
                    + "[--bus-stops <버스정류장.csv>] [--access] [--dry-run | --sql-out out.sql]   (--places 는 --kcisa 가 필요해요)");
            System.exit(1);
        }
        if (a.containsKey("bus-routes")) {
            System.out.println("※ --bus-routes(버스노선별 경유정류장)는 활용 가이드 PDF 의 요청 형식을 확인한 뒤 추가할 예정이에요. 이번에는 건너뛰어요.");
        }

        KcisaIndex kcisa = kcisaCsv == null || hospitalCsv == null ? null : KcisaIndex.load(Path.of(kcisaCsv));
        if (kcisaCsv == null && hospitalCsv != null) System.out.println("※ --kcisa 가 없어 영업시간·휴무일은 비워 둬요.");
        List<PlaceRow> places = withPlaces ? readPlaces(Path.of(kcisaCsv)) : List.of();

        List<Biz> hospitals = hospitalCsv == null ? List.of()
                : readLicense(Path.of(hospitalCsv), "병원", kcisa, KCISA_HOSPITAL_CATS);
        List<Biz> hotels = hotelCsv == null ? List.of()
                : readLicense(Path.of(hotelCsv), "호텔", null, null);   // 호텔은 영업시간 저장 안 함
        List<StopRow> stops = stopsCsv == null ? List.of() : readBusStops(Path.of(stopsCsv));

        if (a.containsKey("dry-run")) {
            printSamples("병원", hospitals);
            printSamples("호텔", hotels);
            if (withPlaces) printPlaceSummary(places);
            if (!stops.isEmpty()) printStopSummary(stops, places);
            System.out.println("dry-run 이라 DB 에는 저장하지 않았어요.");
            return;
        }
        if (a.containsKey("sql-out")) {
            writeSqlFile(Path.of(a.get("sql-out")), hospitals, hotels, places, stops);
            return;
        }

        DbInfo db = askDbInfo(a);
        String url = "jdbc:mysql://" + db.host + ":" + db.port + "/" + db.name
                + "?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Seoul"
                + "&rewriteBatchedStatements=true&connectTimeout=10000&allowPublicKeyRetrieval=true";
        try (Connection con = DriverManager.getConnection(url, db.user, db.password)) {
            System.out.println("✔ DB 연결 성공: " + db.host + ":" + db.port + "/" + db.name);
            if (!hospitals.isEmpty() || !hotels.isEmpty()) ensureColumns(con);
            if (!hospitals.isEmpty()) upsert(con, hospitals, true);
            if (!hotels.isEmpty()) upsert(con, hotels, false);
            if (withPlaces) {
                ensurePlaceColumns(con);
                upsertPlaces(con, places);
            }
            if (!stops.isEmpty()) {
                ensureBusTables(con);
                upsertBusStops(con, stops);
            }
            // 새로 넣은 장소 · 병원 · 호텔 · 정류장이 있으면 지역 · 가까운 정류장을 다시 계산
            if (withAccess || withPlaces || !hospitals.isEmpty() || !hotels.isEmpty() || !stops.isEmpty()) {
                ensureBusTables(con);
                ensureAccessColumns(con);
                updateAccess(con);
            }
            printDbCounts(con);
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().contains("No suitable driver")) {
                System.err.println("✘ MySQL JDBC 드라이버를 못 찾았어요. -cp mysql-connector-j-x.x.x.jar 를 붙여 실행해 주세요.");
            } else {
                System.err.println("✘ DB 오류: " + e.getMessage());
            }
            System.exit(2);
        }
    }

    // ------------------------------------------------------------------ 업체 레코드
    static class Biz {
        String licenseNo, name, address, phone;
        String hours;            // 병원만: "운영시간 / 휴무: 휴무일"
        double lat, lng;
        String matchedKcisaName; // 로그용
    }

    /** "월~금 10:00~20:00" + "매주 일요일" → "월~금 10:00~20:00 / 휴무: 매주 일요일" */
    static String joinHours(String hours, String closedDays) {
        if (hours == null && closedDays == null) return null;
        if (closedDays == null) return hours;
        if (hours == null) return "휴무: " + closedDays;
        return hours + " / 휴무: " + closedDays;
    }

    // ------------------------------------------------------------------ 인허가 CSV 읽기
    static List<Biz> readLicense(Path csv, String label, KcisaIndex kcisa, Set<String> cats) throws IOException {
        List<String[]> rows = Csv.read(csv);
        Map<String, Integer> h = Csv.header(rows.remove(0));
        int cMgt = col(h, "관리번호"), cStatus = col(h, "영업상태명"),
                cName = col(h, "사업장명"), cRoad = col(h, "도로명주소"), cJibun = col(h, "지번주소"),
                cTel = col(h, "전화번호"), cX = col(h, "좌표정보(X)"), cY = col(h, "좌표정보(Y)");

        int total = rows.size(), notOpen = 0, noCoord = 0, badCoord = 0, withHours = 0, matched = 0;
        List<Biz> out = new ArrayList<>();
        for (String[] r : rows) {
            if (!OPEN_STATUS.equals(get(r, cStatus))) { notOpen++; continue; }
            String xs = get(r, cX), ys = get(r, cY);
            if (xs.isEmpty() || ys.isEmpty()) { noCoord++; continue; }
            double[] ll = Epsg5174.toWgs84(Double.parseDouble(xs), Double.parseDouble(ys));
            if (!inKorea(ll[0], ll[1])) { badCoord++; continue; }

            Biz b = new Biz();
            b.licenseNo = get(r, cMgt);
            b.name = cut(get(r, cName), 100);
            String road = get(r, cRoad);
            b.address = cut(road.isEmpty() ? get(r, cJibun) : road, 255);
            b.phone = Phone.format(get(r, cTel), b.address);
            b.lat = round7(ll[0]);
            b.lng = round7(ll[1]);

            if (kcisa != null) {
                KcisaIndex.Entry e = kcisa.match(b.name, road, b.lat, b.lng, cats);
                if (e != null) {
                    matched++;
                    b.matchedKcisaName = e.name;
                    b.hours = cut(joinHours(e.hours, e.closedDays), 255);
                    if (e.hours != null) withHours++;
                }
            }
            out.add(b);
        }
        System.out.printf("[%s] %s: 전체 %,d행 → 영업 중 저장 대상 %,d곳 (영업 아님 %,d · 좌표 없음 %,d · 좌표 이상 %,d)%n",
                label, csv.getFileName(), total, out.size(), notOpen, noCoord, badCoord);
        if (kcisa != null)
            System.out.printf("[%s] 한국문화정보원 매칭 %,d곳 · 그중 영업시간 있음 %,d곳%n", label, matched, withHours);
        return out;
    }

    // ------------------------------------------------------------------ 한국문화정보원 인덱스
    static class KcisaIndex {
        static class Entry {
            String name, normName, normRoad, category, hours, closedDays;
            double lat, lng;
        }
        final Map<Long, List<Entry>> grid = new HashMap<>(); // 약 1km 격자

        static KcisaIndex load(Path csv) throws IOException {
            List<String[]> rows = Csv.read(csv);
            Map<String, Integer> h = Csv.header(rows.remove(0));
            int cName = col(h, "시설명"), cCat = col(h, "카테고리3"), cLat = col(h, "위도"), cLng = col(h, "경도"),
                    cRoad = col(h, "도로명주소"), cJibun = col(h, "지번주소"), cOff = col(h, "휴무일"), cHours = col(h, "운영시간");
            Set<String> allCats = KCISA_HOSPITAL_CATS;

            KcisaIndex idx = new KcisaIndex();
            Set<String> seen = new HashSet<>(); // 같은 시설이 여러 번 들어 있어서 중복 제거
            int kept = 0;
            for (String[] r : rows) {
                String cat = get(r, cCat);
                if (!allCats.contains(cat)) continue;
                String key = get(r, cName) + "|" + get(r, cRoad) + "|" + get(r, cJibun) + "|" + cat;
                if (!seen.add(key)) continue;
                double lat, lng;
                try { lat = Double.parseDouble(get(r, cLat)); lng = Double.parseDouble(get(r, cLng)); }
                catch (NumberFormatException ex) { continue; }
                Entry e = new Entry();
                e.name = get(r, cName);
                e.normName = normName(e.name);
                e.normRoad = normRoad(get(r, cRoad));
                e.category = cat;
                e.lat = lat; e.lng = lng;
                e.hours = infoOrNull(get(r, cHours));
                e.closedDays = infoOrNull(get(r, cOff));
                idx.grid.computeIfAbsent(cell(lat, lng), k -> new ArrayList<>()).add(e);
                kept++;
            }
            System.out.printf("[한국문화정보원] %s: 동물병원 %,d곳 (중복 제거 후)%n", csv.getFileName(), kept);
            return idx;
        }

        /** 1순위: 이름이 같고 150m 이내 / 2순위: 도로명주소가 같고 이름이 서로 포함되며 300m 이내. 가장 가까운 것. */
        Entry match(String name, String road, double lat, double lng, Set<String> cats) {
            String n1 = normName(name), a1 = normRoad(road);
            Entry best = null; int bestRule = 9; double bestD = 1e18;
            long base = cell(lat, lng);
            for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
                List<Entry> list = grid.get(base + dy * 100000L + dx);
                if (list == null) continue;
                for (Entry e : list) {
                    if (!cats.contains(e.category)) continue;
                    double d = Geo.distM(lat, lng, e.lat, e.lng);
                    int rule;
                    if (n1.equals(e.normName) && d <= MATCH_NAME_M) rule = 1;
                    else if (!a1.isEmpty() && a1.equals(e.normRoad)
                            && (n1.contains(e.normName) || e.normName.contains(n1)) && d <= MATCH_ADDR_M) rule = 2;
                    else continue;
                    if (rule < bestRule || (rule == bestRule && d < bestD)) { best = e; bestRule = rule; bestD = d; }
                }
            }
            return best;
        }

        static long cell(double lat, double lng) {
            return Math.round(lat * 100) * 100000L + Math.round(lng * 100);
        }
    }

    static String normName(String s) { return s.replaceAll("[\\s()\\[\\]·.,\\-_&'\"]", "").toLowerCase(Locale.ROOT); }
    static String normRoad(String s) { return s.split("[,(]", 2)[0].replaceAll("\\s", ""); }
    static String infoOrNull(String s) { return (s.isEmpty() || s.equals("정보없음")) ? null : s; }

    // ------------------------------------------------------------------ 좌표 변환 EPSG:5174 → WGS84
    /**
     * EPSG:5174 = Korean 1985 / Modified Central Belt
     *   +proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel
     *   +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43  (Position Vector 7-파라미터)
     * 순서: TM 역변환(Bessel 위경도) → 지심좌표(ECEF) → 7-파라미터 변환 → WGS84 위경도
     * 검증: 한국문화정보원 WGS84 좌표와 같은 병원 3,901곳 비교 시 거리 중앙값 약 4.6m
     */
    static final class Epsg5174 {
        static final double BESSEL_A = 6377397.155, BESSEL_F = 1 / 299.1528128;
        static final double WGS_A = 6378137.0, WGS_F = 1 / 298.257223563;
        static final double LAT0 = Math.toRadians(38), LON0 = Math.toRadians(127.0028902777778);
        static final double K0 = 1, X0 = 200000, Y0 = 500000;
        static final double TX = -115.80, TY = 474.99, TZ = 674.11;
        static final double SEC = Math.PI / 180 / 3600;
        static final double RX = 1.16 * SEC, RY = -2.31 * SEC, RZ = -1.63 * SEC, S = 1 + 6.43e-6;

        /** @return {위도, 경도} (WGS84, 도 단위) */
        static double[] toWgs84(double x, double y) {
            double[] g = tmInverse(x, y);
            double[] xyz = Geo.toEcef(g[0], g[1], BESSEL_A, BESSEL_F);
            double X = xyz[0], Y = xyz[1], Z = xyz[2];
            double X2 = TX + S * (X - RZ * Y + RY * Z);
            double Y2 = TY + S * (RZ * X + Y - RX * Z);
            double Z2 = TZ + S * (-RY * X + RX * Y + Z);
            double[] w = Geo.fromEcef(X2, Y2, Z2, WGS_A, WGS_F);
            return new double[]{Math.toDegrees(w[0]), Math.toDegrees(w[1])};
        }

        static double meridian(double phi, double a, double e2) {
            double e4 = e2 * e2, e6 = e4 * e2;
            return a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
                    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
                    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
                    - (35 * e6 / 3072) * Math.sin(6 * phi));
        }

        /** 횡메르카토르 역변환 (Snyder) — Bessel 위경도(라디안) */
        static double[] tmInverse(double x, double y) {
            double a = BESSEL_A, f = BESSEL_F, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
            double e4 = e2 * e2, e6 = e4 * e2;
            double m = meridian(LAT0, a, e2) + (y - Y0) / K0;
            double mu = m / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
            double e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
            double p1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
                    + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
                    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu)
                    + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
            double sin = Math.sin(p1), cos = Math.cos(p1), tan = Math.tan(p1);
            double c1 = ep2 * cos * cos, t1 = tan * tan;
            double n1 = a / Math.sqrt(1 - e2 * sin * sin);
            double r1 = a * (1 - e2) / Math.pow(1 - e2 * sin * sin, 1.5);
            double d = (x - X0) / (n1 * K0);
            double lat = p1 - (n1 * tan / r1) * (d * d / 2
                    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * Math.pow(d, 4) / 24
                    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * Math.pow(d, 6) / 720);
            double lon = LON0 + (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6
                    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * Math.pow(d, 5) / 120) / cos;
            return new double[]{lat, lon};
        }
    }

    static final class Geo {
        static double[] toEcef(double lat, double lon, double a, double f) {
            double e2 = f * (2 - f), n = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(lat), 2));
            return new double[]{n * Math.cos(lat) * Math.cos(lon), n * Math.cos(lat) * Math.sin(lon), n * (1 - e2) * Math.sin(lat)};
        }

        static double[] fromEcef(double x, double y, double z, double a, double f) {
            double e2 = f * (2 - f), p = Math.hypot(x, y), lon = Math.atan2(y, x);
            double lat = Math.atan2(z, p * (1 - e2));
            for (int i = 0; i < 10; i++) {
                double n = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(lat), 2));
                double h = p / Math.cos(lat) - n;
                lat = Math.atan2(z, p * (1 - e2 * n / (n + h)));
            }
            return new double[]{lat, lon};
        }

        static double distM(double la1, double lo1, double la2, double lo2) {
            double p1 = Math.toRadians(la1), p2 = Math.toRadians(la2);
            double dp = p2 - p1, dl = Math.toRadians(lo2 - lo1);
            double h = Math.pow(Math.sin(dp / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2);
            return 2 * 6371000 * Math.asin(Math.sqrt(h));
        }
    }

    static boolean inKorea(double lat, double lng) { return lat > 32.8 && lat < 38.9 && lng > 124.3 && lng < 132.0; }
    static double round7(double v) { return Math.round(v * 1e7) / 1e7; }

    // ------------------------------------------------------------------ 전화번호 정리
    static final class Phone {
        static final String[][] AREA = {
                {"서울", "02"}, {"부산", "051"}, {"대구", "053"}, {"인천", "032"}, {"광주광역시", "062"},
                {"대전", "042"}, {"울산", "052"}, {"세종", "044"}, {"경기", "031"}, {"강원", "033"},
                {"충청북도", "043"}, {"충북", "043"}, {"충청남도", "041"}, {"충남", "041"},
                {"전북", "063"}, {"전라북도", "063"}, {"전라남도", "061"}, {"경상북도", "054"}, {"경북", "054"},
                {"경상남도", "055"}, {"경남", "055"}, {"제주", "064"}};

        /** "0212345678" → "02-1234-5678". 지역번호가 빠진 7~8자리는 주소의 시·도로 지역번호를 붙여요. */
        static String format(String raw, String address) {
            String d = raw.replaceAll("[^0-9]", "");
            if (d.length() < 7) return null;
            if (!d.startsWith("0") && !d.matches("1[5-9]\\d{6}") && d.length() <= 8) {
                String area = areaCode(address);
                if (area == null) return cut(raw.trim(), 20);
                d = area + d;
            }
            if (d.matches("1[5-9]\\d{6}")) return d.substring(0, 4) + "-" + d.substring(4);       // 1588-0000
            if (d.startsWith("02")) return split(d, 2);
            if (d.matches("050\\d{9}")) return d.substring(0, 4) + "-" + d.substring(4, 8) + "-" + d.substring(8); // 0507-
            if (d.startsWith("0") && (d.length() == 10 || d.length() == 11)) return split(d, 3);
            return cut(raw.trim(), 20);
        }

        static String split(String d, int p) {
            String rest = d.substring(p);
            if (rest.length() < 7 || rest.length() > 8) return d;
            int mid = rest.length() - 4;
            return d.substring(0, p) + "-" + rest.substring(0, mid) + "-" + rest.substring(mid);
        }

        static String areaCode(String address) {
            String first = address.split(" ", 2)[0];
            if (first.startsWith("전남광주")) {   // 통합특별시: 광주 시내 구면 062, 나머지 061
                return address.matches("^\\S+ (동구|서구|남구|북구|광산구).*") ? "062" : "061";
            }
            for (String[] ac : AREA) if (first.startsWith(ac[0])) return ac[1];
            return null;
        }
    }

    // ------------------------------------------------------------------ DB
    static class DbInfo { String host, port, name, user; String password; }

    static DbInfo askDbInfo(Map<String, String> a) throws IOException {
        Console console = System.console();
        BufferedReader in = console == null ? new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)) : null;
        DbInfo db = new DbInfo();
        // 인자로 준 값은 묻지 않아요 (getOrDefault 는 기본값을 먼저 계산해 버려서 쓰지 않음)
        db.host = a.containsKey("host") ? a.get("host") : ask(console, in, "DB 주소 (예: 123.45.67.89)", null);
        db.port = a.containsKey("port") ? a.get("port") : ask(console, in, "포트", "3306");
        db.name = a.containsKey("db") ? a.get("db") : ask(console, in, "DB 이름", "petplanet");
        db.user = a.containsKey("user") ? a.get("user") : ask(console, in, "아이디", null);
        if (console != null) {
            char[] pw = console.readPassword("비밀번호: ");
            db.password = pw == null ? "" : new String(pw);
        } else {
            System.out.print("비밀번호 (입력이 화면에 보여요): ");
            String pw = in.readLine();
            db.password = pw == null ? "" : pw;
        }
        return db;
    }

    static String ask(Console c, BufferedReader in, String label, String def) throws IOException {
        while (true) {
            String prompt = label + (def != null ? " [" + def + "]" : "") + ": ";
            String v;
            if (c != null) v = c.readLine(prompt);
            else { System.out.print(prompt); v = in.readLine(); }
            if (v == null) {   // 입력 끝(Ctrl+D 등): 무한 반복하지 않고 종료
                System.err.println("\n입력이 끝나 종료해요.");
                System.exit(1);
            }
            v = v.trim();
            if (v.isEmpty() && def != null) return def;
            if (!v.isEmpty()) return v;
        }
    }

    /** license_no(관리번호) 칼럼과 UNIQUE 가 없으면 추가 (db/patch_be2_public_data.sql 과 같은 내용, 여러 번 실행해도 안전) */
    static void ensureColumns(Connection con) throws SQLException {
        try (Statement st = con.createStatement()) {
            for (String t : new String[]{"hospitals", "pet_hotels"}) {
                if (!columnExists(con, t, "license_no")) {
                    st.execute("ALTER TABLE " + t + " ADD COLUMN license_no VARCHAR(20) NULL "
                            + "COMMENT '공공데이터 인허가 관리번호 (직접 넣은 업체는 NULL)' AFTER user_id");
                    System.out.println("  + 칼럼 추가: " + t + ".license_no");
                }
                if (!indexExists(con, t, "uk_" + t + "_license_no")) {
                    st.execute("ALTER TABLE " + t + " ADD UNIQUE KEY uk_" + t + "_license_no (license_no)");
                    System.out.println("  + UNIQUE 추가: " + t + ".license_no");
                }
            }
        }
    }

    static boolean columnExists(Connection con, String table, String column) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?")) {
            ps.setString(1, table); ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    static boolean indexExists(Connection con, String table, String index) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?")) {
            ps.setString(1, table); ps.setString(2, index);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    // 전화번호·영업시간은 새 값이 있을 때만 덮어써요 (직접 입력해 둔 값이 NULL 로 지워지지 않게)
    static final String HOSPITAL_COLS = "license_no, name, address, phone, latitude, longitude, operating_hours";
    static final String HOSPITAL_UPDATE = "ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), "
            + "phone = COALESCE(VALUES(phone), phone), latitude = VALUES(latitude), longitude = VALUES(longitude), "
            + "operating_hours = COALESCE(VALUES(operating_hours), operating_hours)";
    static final String HOTEL_COLS = "license_no, name, address, phone, latitude, longitude";
    static final String HOTEL_UPDATE = "ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), "
            + "phone = COALESCE(VALUES(phone), phone), latitude = VALUES(latitude), longitude = VALUES(longitude)";

    static void upsert(Connection con, List<Biz> list, boolean hospital) throws SQLException {
        String table = hospital ? "hospitals" : "pet_hotels";
        String sql = hospital
                ? "INSERT INTO hospitals (" + HOSPITAL_COLS + ") VALUES (?, ?, ?, ?, ?, ?, ?) " + HOSPITAL_UPDATE
                : "INSERT INTO pet_hotels (" + HOTEL_COLS + ") VALUES (?, ?, ?, ?, ?, ?) " + HOTEL_UPDATE;
        boolean auto = con.getAutoCommit();
        con.setAutoCommit(false);   // 테이블 하나를 한 트랜잭션으로: 중간에 실패하면 전부 롤백
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            int n = 0;
            for (Biz b : list) {
                ps.setString(1, b.licenseNo);
                ps.setString(2, b.name);
                ps.setString(3, b.address);
                ps.setString(4, b.phone);
                ps.setBigDecimal(5, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", b.lat)));
                ps.setBigDecimal(6, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", b.lng)));
                if (hospital) ps.setString(7, b.hours);
                ps.addBatch();
                if (++n % BATCH == 0) { ps.executeBatch(); System.out.printf("\r  %s 저장 중 %,d / %,d", table, n, list.size()); }
            }
            ps.executeBatch();
            con.commit();
            System.out.printf("\r✔ %s 저장 완료 %,d곳%n", table, n);
        } catch (SQLException e) {
            con.rollback();
            System.err.println("\n✘ " + table + " 저장 실패 → 롤백했어요");
            throw e;
        } finally {
            con.setAutoCommit(auto);
        }
    }

    static void printDbCounts(Connection con) throws SQLException {
        try (Statement st = con.createStatement()) {
            try (ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*), SUM(license_no IS NOT NULL), SUM(operating_hours IS NOT NULL) FROM hospitals")) {
                rs.next();
                System.out.printf("  hospitals: 전체 %,d행 (공공데이터 %,d · 영업시간 있음 %,d)%n", rs.getLong(1), rs.getLong(2), rs.getLong(3));
            }
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*), SUM(license_no IS NOT NULL) FROM pet_hotels")) {
                rs.next();
                System.out.printf("  pet_hotels: 전체 %,d행 (공공데이터 %,d)%n", rs.getLong(1), rs.getLong(2));
            }
            if (tableExists(con, "bus_stops")) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM bus_stops")) {
                    rs.next();
                    System.out.printf("  bus_stops: %,d곳%n", rs.getLong(1));
                }
            }
            if (columnExists(con, "places", "nearest_stop_id")) {
                for (String t : new String[]{"places", "hospitals", "pet_hotels"}) {
                    try (ResultSet rs = st.executeQuery("SELECT COUNT(*), SUM(sido IS NOT NULL), SUM(nearest_stop_m <= 300) FROM " + t)) {
                        rs.next();
                        System.out.printf("  %s: 지역 있음 %,d / %,d · 정류장 300m 이내 %,d%n", t, rs.getLong(2), rs.getLong(1), rs.getLong(3));
                    }
                }
            }
            if (columnExists(con, "places", "source_key")) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*), SUM(source_key IS NOT NULL) FROM places")) {
                    rs.next();
                    System.out.printf("  places: 전체 %,d행 (공공데이터 %,d)%n", rs.getLong(1), rs.getLong(2));
                }
            }
        }
    }

    // ------------------------------------------------------------------ 동반 장소 (--places)
    /** 한국문화정보원 카테고리3 → place_categories 이름. 동반 "장소"만 넣어요 (약국·병원·용품·미용·위탁 제외) */
    static final Map<String, String> PLACE_CATEGORY = Map.of(
            "카페", "카페", "식당", "식당", "펜션", "숙소", "호텔", "숙소",
            "여행지", "여행지", "박물관", "문화시설", "미술관", "문화시설", "문예회관", "문화시설");
    /** 없으면 추가할 카테고리 (카페·식당·숙소는 seed_dev_places.sql 에 이미 있어요) */
    static final List<String> PLACE_CATEGORY_NAMES = List.of("카페", "식당", "숙소", "여행지", "문화시설");

    static class PlaceRow {
        String key, category, name, address, phone, description, size, inout;
        double lat, lng;
    }

    static List<PlaceRow> readPlaces(Path csv) throws IOException {
        List<String[]> rows = Csv.read(csv);
        Map<String, Integer> h = Csv.header(rows.remove(0));
        int cName = col(h, "시설명"), cCat = col(h, "카테고리3"), cLat = col(h, "위도"), cLng = col(h, "경도"),
                cRoad = col(h, "도로명주소"), cJibun = col(h, "지번주소"), cTel = col(h, "전화번호"),
                cOff = col(h, "휴무일"), cHours = col(h, "운영시간"), cOk = col(h, "반려동물 동반 가능정보"),
                cSize = col(h, "입장 가능 동물 크기"), cLimit = col(h, "반려동물 제한사항"),
                cIn = col(h, "장소(실내) 여부"), cOut = col(h, "장소(실외)여부"), cDesc = col(h, "기본 정보_장소설명"),
                cFee = col(h, "애견 동반 추가 요금");
        List<PlaceRow> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int notAllowed = 0, noCoord = 0;
        for (String[] r : rows) {
            String category = PLACE_CATEGORY.get(get(r, cCat));
            if (category == null) continue;
            if (!"Y".equals(get(r, cOk))) { notAllowed++; continue; }   // 동반 불가 시설은 제외
            double lat, lng;
            try { lat = Double.parseDouble(get(r, cLat)); lng = Double.parseDouble(get(r, cLng)); }
            catch (NumberFormatException ex) { noCoord++; continue; }
            if (!inKorea(lat, lng)) { noCoord++; continue; }
            String address = get(r, cRoad).isEmpty() ? get(r, cJibun) : get(r, cRoad);
            if (address.isEmpty()) continue;
            String name = get(r, cName);
            String key = md5(name + "|" + address);
            if (!seen.add(key)) continue;   // 같은 시설이 여러 번 들어 있어요
            PlaceRow p = new PlaceRow();
            p.key = key;
            p.category = category;
            p.name = cut(name, 100);
            p.address = cut(address, 255);
            p.phone = cut(infoOrNull(get(r, cTel)), 20);
            p.lat = round7(lat);
            p.lng = round7(lng);
            p.size = sizeOf(get(r, cSize));
            p.inout = inOutOf(get(r, cIn), get(r, cOut));
            p.description = describe(get(r, cCat), get(r, cDesc), get(r, cHours), get(r, cOff), get(r, cLimit), get(r, cFee));
            out.add(p);
        }
        System.out.printf("[한국문화정보원] %s: 동반 장소 %,d곳 저장 대상 (동반 불가 %,d · 좌표 없음 %,d 제외)%n",
                csv.getFileName(), out.size(), notAllowed, noCoord);
        return out;
    }

    /** 입장 가능 동물 크기 → 동반 가능한 가장 큰 크기 (SMALL · MEDIUM · LARGE) */
    static String sizeOf(String s) {
        if (s.isEmpty() || s.equals("해당없음") || s.equals("정보없음")) return null;
        if (s.contains("모두") || s.contains("대형")) return "LARGE";
        if (s.contains("중형") || s.matches(".*(1[5-9]|2\\d)\\s*kg.*")) return "MEDIUM";
        if (s.contains("소형") || s.contains("kg")) return "SMALL";
        return null;
    }

    static String inOutOf(String in, String outside) {
        boolean i = "Y".equals(in), o = "Y".equals(outside);
        return i && o ? "BOTH" : i ? "INDOOR" : o ? "OUTDOOR" : null;
    }

    /** "운영시간 화~일 09:00~18:00 · 휴무 매주 월요일 · 제한사항: … · 동반 추가 요금: …" */
    static String describe(String cat3, String desc, String hours, String off, String limit, String fee) {
        List<String> parts = new ArrayList<>();
        if (meaningful(desc) && !desc.equals(cat3)) parts.add(desc);
        if (meaningful(hours)) parts.add("운영시간 " + hours);
        if (meaningful(off)) parts.add("휴무 " + off);
        if (meaningful(limit) && !limit.equals("제한사항 없음")) parts.add("제한사항: " + limit);
        if (meaningful(fee) && !fee.equals("없음")) parts.add("동반 추가 요금: " + fee);
        return parts.isEmpty() ? null : cut(String.join(" · ", parts), 1000);
    }

    static boolean meaningful(String s) { return s != null && !s.isEmpty() && !s.equals("정보없음") && !s.equals("해당없음"); }

    static String md5(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("MD5").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** places.source_key(공공데이터 출처 키) 칼럼 · UNIQUE · 카테고리가 없으면 추가 (여러 번 실행해도 안전) */
    static void ensurePlaceColumns(Connection con) throws SQLException {
        try (Statement st = con.createStatement()) {
            if (!columnExists(con, "places", "source_key")) {
                st.execute("ALTER TABLE places ADD COLUMN source_key CHAR(32) NULL "
                        + "COMMENT '공공데이터 출처 키 MD5(시설명|주소) (직접 넣은 장소는 NULL)' AFTER indoor_outdoor");
                System.out.println("  + 칼럼 추가: places.source_key");
            }
            if (!indexExists(con, "places", "uk_places_source_key")) {
                st.execute("ALTER TABLE places ADD UNIQUE KEY uk_places_source_key (source_key)");
                System.out.println("  + UNIQUE 추가: places.source_key");
            }
        }
        try (PreparedStatement ps = con.prepareStatement("INSERT IGNORE INTO place_categories (name) VALUES (?)")) {
            for (String n : PLACE_CATEGORY_NAMES) { ps.setString(1, n); ps.addBatch(); }
            ps.executeBatch();
        }
    }

    static final String PLACE_COLS = "category_id, name, address, phone, latitude, longitude, description, allowed_size, indoor_outdoor, source_key";
    static final String PLACE_UPDATE = "ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name), "
            + "address = VALUES(address), phone = COALESCE(VALUES(phone), phone), latitude = VALUES(latitude), "
            + "longitude = VALUES(longitude), description = VALUES(description), allowed_size = VALUES(allowed_size), "
            + "indoor_outdoor = VALUES(indoor_outdoor)";
    static final String CATEGORY_ID = "(SELECT category_id FROM place_categories WHERE name = %s)";

    static void upsertPlaces(Connection con, List<PlaceRow> list) throws SQLException {
        String sql = "INSERT INTO places (" + PLACE_COLS + ") VALUES (" + String.format(CATEGORY_ID, "?")
                + ", ?, ?, ?, ?, ?, ?, ?, ?, ?) " + PLACE_UPDATE;
        boolean auto = con.getAutoCommit();
        con.setAutoCommit(false);
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            int n = 0;
            for (PlaceRow p : list) {
                ps.setString(1, p.category);
                ps.setString(2, p.name);
                ps.setString(3, p.address);
                ps.setString(4, p.phone);
                ps.setBigDecimal(5, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", p.lat)));
                ps.setBigDecimal(6, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", p.lng)));
                ps.setString(7, p.description);
                ps.setString(8, p.size);
                ps.setString(9, p.inout);
                ps.setString(10, p.key);
                ps.addBatch();
                if (++n % BATCH == 0) { ps.executeBatch(); System.out.printf("\r  places 저장 중 %,d / %,d", n, list.size()); }
            }
            ps.executeBatch();
            con.commit();
            System.out.printf("\r✔ places 저장 완료 %,d곳%n", n);
        } catch (SQLException e) {
            con.rollback();
            System.err.println("\n✘ places 저장 실패 → 롤백했어요");
            throw e;
        } finally {
            con.setAutoCommit(auto);
        }
    }

    static void printPlaceSummary(List<PlaceRow> list) {
        Map<String, Integer> byCat = new TreeMap<>();
        for (PlaceRow p : list) byCat.merge(p.category, 1, Integer::sum);
        System.out.println("---- 동반 장소 카테고리별: " + byCat);
        long local = list.stream().filter(p -> p.address.contains("목포시") || p.address.contains("무안군")).count();
        System.out.printf("---- 목포시 · 무안군: %,d곳%n", local);
        list.stream().filter(p -> p.address.contains("목포시") || p.address.contains("무안군")).limit(8).forEach(p -> System.out.printf(
                "  [%s] %s | %s | %s · %s | %.6f, %.6f%n", p.category, p.name, p.address, p.size, p.inout, p.lat, p.lng));
    }

    static void writePlaceInserts(BufferedWriter w, List<PlaceRow> list) throws IOException {
        for (String n : PLACE_CATEGORY_NAMES) w.write("INSERT IGNORE INTO place_categories (name) VALUES (" + q(n) + ");\n");
        for (int i = 0; i < list.size(); i += BATCH) {
            w.write("INSERT INTO places (" + PLACE_COLS + ") VALUES\n");
            List<PlaceRow> part = list.subList(i, Math.min(i + BATCH, list.size()));
            for (int j = 0; j < part.size(); j++) {
                PlaceRow p = part.get(j);
                w.write(String.format(Locale.ROOT, "(%s, %s, %s, %s, %.7f, %.7f, %s, %s, %s, %s)",
                        String.format(CATEGORY_ID, q(p.category)), q(p.name), q(p.address), q(p.phone), p.lat, p.lng,
                        q(p.description), q(p.size), q(p.inout), q(p.key)) + (j == part.size() - 1 ? "\n" : ",\n"));
            }
            w.write(PLACE_UPDATE + ";\n");
        }
    }

    // ------------------------------------------------------------------ 버스 정류장 (--bus-stops) · 접근성 (--access)
    static class StopRow {
        String id, name, cityCode, cityName, collectedAt;
        double lat, lng;
    }

    /** 국토교통부 전국 버스정류장 위치정보 CSV — 칼럼 이름이 조금 달라도 찾도록 후보를 여러 개 둬요 */
    static List<StopRow> readBusStops(Path csv) throws IOException {
        List<String[]> rows = Csv.read(csv);
        Map<String, Integer> h = Csv.header(rows.remove(0));
        int cId = colAny(h, true, "정류장번호", "정류장ID", "정류소ID", "정류소번호", "노드ID", "NODE_ID");
        int cName = colAny(h, true, "정류장명", "정류소명", "노드명");
        int cLat = colAny(h, true, "위도", "GPS_LATI", "Y좌표");
        int cLng = colAny(h, true, "경도", "GPS_LONG", "X좌표");
        int cCity = colAny(h, false, "도시코드", "CITY_CODE");
        int cCityName = colAny(h, false, "도시명", "관리도시명");
        int cDate = colAny(h, false, "정보수집일", "수집일");
        List<StopRow> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int bad = 0, dup = 0;
        for (String[] r : rows) {
            String id = get(r, cId);
            double lat, lng;
            try { lat = Double.parseDouble(get(r, cLat)); lng = Double.parseDouble(get(r, cLng)); }
            catch (NumberFormatException ex) { bad++; continue; }
            if (id.isEmpty() || !inKorea(lat, lng)) { bad++; continue; }
            if (!seen.add(id)) { dup++; continue; }
            StopRow sr = new StopRow();
            sr.id = cut(id, 30);
            sr.name = cut(get(r, cName), 100);
            sr.lat = round7(lat);
            sr.lng = round7(lng);
            sr.cityCode = cCity < 0 ? null : cut(emptyToNull(get(r, cCity)), 10);
            sr.cityName = cCityName < 0 ? null : cut(emptyToNull(get(r, cCityName)), 30);
            sr.collectedAt = cDate < 0 ? null : isoDate(get(r, cDate));
            out.add(sr);
        }
        System.out.printf("[국토교통부] %s: 버스 정류장 %,d곳 (좌표·ID 없음 %,d · 중복 ID %,d 제외)%n", csv.getFileName(), out.size(), bad, dup);
        return out;
    }

    static String emptyToNull(String s) { return s == null || s.isEmpty() ? null : s; }

    /** "2025-10-30" · "20251030" · "2025.10.30" → "2025-10-30", 못 읽으면 null */
    static String isoDate(String s) {
        String d = s.replaceAll("[^0-9]", "");
        return d.length() >= 8 ? d.substring(0, 4) + "-" + d.substring(4, 6) + "-" + d.substring(6, 8) : null;
    }

    static void printStopSummary(List<StopRow> stops, List<PlaceRow> places) {
        Map<String, Integer> byCity = new HashMap<>();
        for (StopRow st : stops) byCity.merge(st.cityName == null ? "(도시명 없음)" : st.cityName, 1, Integer::sum);
        System.out.println("---- 정류장 많은 도시 10곳: " + byCity.entrySet().stream()
                .sorted((x, y) -> y.getValue() - x.getValue()).limit(10).map(e -> e.getKey() + " " + e.getValue()).toList());
        System.out.println("---- 서울 데이터 포함 여부: " + byCity.keySet().stream().anyMatch(k -> k.contains("서울")));
        StopIndex idx = new StopIndex(stops);
        double[][] spots = {{34.7914, 126.3866}, {34.9113, 126.4377}};
        String[] names = {"목포역", "국립목포대학교"};
        for (int i = 0; i < spots.length; i++) {
            StopIndex.Near n = idx.near(spots[i][0], spots[i][1]);
            System.out.printf("---- %s 기준: 가장 가까운 정류장 %s (%s) %dm · 반경 500m 정류장 %d곳%n", names[i],
                    n.stop == null ? "-" : n.stop.name, n.stop == null ? "-" : n.stop.id, n.meters == null ? -1 : n.meters, n.within500);
        }
        if (!places.isEmpty()) {
            Map<String, Integer> grades = new TreeMap<>();
            for (PlaceRow p : places) {
                if (!(p.address.contains("목포시") || p.address.contains("무안군"))) continue;   // 주소가 전라남도 · 전남광주통합특별시 어느 쪽이어도
                StopIndex.Near n = idx.near(p.lat, p.lng);
                String g = grade(n.meters, n.within500);
                grades.merge(g, 1, Integer::sum);
                System.out.printf("  [%s] %s → %s %sm (500m 안 %d곳)%n", g, p.name, n.stop == null ? "-" : n.stop.name,
                        n.meters == null ? "-" : n.meters, n.within500);
            }
            System.out.println("---- 목포시 · 무안군 동반 장소 등급(노선 정보 없이 계산): " + grades);
        }
    }

    /** 백엔드 BusAccess.grade 와 같은 규칙 (노선 수 없이: 반경 500m 정류장 4곳 이상이면 +1) */
    static String grade(Integer m, int within500) {
        if (m == null) return "D";
        int pts = m <= 200 ? 3 : m <= 400 ? 2 : m <= 800 ? 1 : 0;
        if (pts > 0 && within500 >= 4) pts++;
        return pts >= 4 ? "A" : pts == 3 ? "B" : pts >= 1 ? "C" : "D";
    }

    /** 0.01° 격자로 정류장을 나눠 두고 주변 칸만 봐요 (정류장 20만 곳 × 시설 1만 곳도 몇 초) */
    static final class StopIndex {
        static final double CELL = 0.01;          // 위도 약 1.1km
        static final int SEARCH_M = 2_000;        // 2km 안에 정류장이 없으면 "가까운 정류장 없음"
        final Map<Long, List<StopRow>> grid = new HashMap<>();

        static final class Near {
            StopRow stop;
            Integer meters;
            int within500;
        }

        StopIndex(List<StopRow> stops) {
            for (StopRow st : stops) grid.computeIfAbsent(key(cell(st.lat), cell(st.lng)), k -> new ArrayList<>()).add(st);
        }

        static int cell(double v) { return (int) Math.floor(v / CELL); }
        static long key(int a, int b) { return ((long) a << 32) ^ (b & 0xffffffffL); }

        Near near(double lat, double lng) {
            Near n = new Near();
            int cl = cell(lat), cg = cell(lng);
            double best = Double.MAX_VALUE;
            for (int dy = -2; dy <= 2; dy++) {
                for (int dx = -3; dx <= 3; dx++) {
                    List<StopRow> list = grid.get(key(cl + dy, cg + dx));
                    if (list == null) continue;
                    for (StopRow st : list) {
                        double d = Geo.distM(lat, lng, st.lat, st.lng);
                        if (d <= 500) n.within500++;
                        if (d < best) { best = d; n.stop = st; }
                    }
                }
            }
            if (n.stop != null && best <= SEARCH_M) n.meters = (int) Math.round(best);
            else n.stop = null;
            return n;
        }
    }

    static boolean tableExists(Connection con, String table) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    static boolean constraintExists(Connection con, String table, String name) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?")) {
            ps.setString(1, table); ps.setString(2, name);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    /** 버스 테이블이 없으면 만들어요 (db/patch_bus_transit.sql 과 같은 내용) */
    static void ensureBusTables(Connection con) throws SQLException {
        try (Statement st = con.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS bus_stops ("
                    + " stop_id VARCHAR(30) PRIMARY KEY COMMENT '정류장 ID (국토교통부 정류장번호)',"
                    + " name VARCHAR(100) NOT NULL COMMENT '정류장명',"
                    + " latitude DECIMAL(10,7) NOT NULL COMMENT '위도', longitude DECIMAL(10,7) NOT NULL COMMENT '경도',"
                    + " city_code VARCHAR(10) COMMENT '도시코드', city_name VARCHAR(30) COMMENT '도시명', collected_at DATE COMMENT '정보 수집일',"
                    + " INDEX idx_bus_stops_coordinates (latitude, longitude), INDEX idx_bus_stops_city (city_code)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='버스 정류장'");
            st.execute("CREATE TABLE IF NOT EXISTS bus_routes ("
                    + " route_id VARCHAR(30) PRIMARY KEY COMMENT '노선 ID', route_no VARCHAR(30) NOT NULL COMMENT '노선번호',"
                    + " route_name VARCHAR(100) COMMENT '노선명', sido VARCHAR(20) COMMENT '시/도', sigungu VARCHAR(30) COMMENT '시/군/구',"
                    + " INDEX idx_bus_routes_region (sido, sigungu), INDEX idx_bus_routes_no (route_no)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='버스 노선'");
            st.execute("CREATE TABLE IF NOT EXISTS bus_route_stops ("
                    + " route_id VARCHAR(30) NOT NULL COMMENT '노선 ID', stop_seq INT NOT NULL COMMENT '노선 안 정류장 순번',"
                    + " stop_id VARCHAR(30) NOT NULL COMMENT '정류장 ID', PRIMARY KEY (route_id, stop_seq),"
                    + " CONSTRAINT fk_bus_route_stops_route_id FOREIGN KEY (route_id) REFERENCES bus_routes(route_id) ON DELETE CASCADE ON UPDATE CASCADE,"
                    + " CONSTRAINT fk_bus_route_stops_stop_id FOREIGN KEY (stop_id) REFERENCES bus_stops(stop_id) ON DELETE CASCADE ON UPDATE CASCADE,"
                    + " INDEX idx_bus_route_stops_stop (stop_id)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='노선별 경유 정류장'");
        }
    }

    static final String STOP_COLS = "stop_id, name, latitude, longitude, city_code, city_name, collected_at";
    static final String STOP_UPDATE = "ON DUPLICATE KEY UPDATE name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), "
            + "city_code = VALUES(city_code), city_name = VALUES(city_name), collected_at = VALUES(collected_at)";

    static void upsertBusStops(Connection con, List<StopRow> list) throws SQLException {
        String sql = "INSERT INTO bus_stops (" + STOP_COLS + ") VALUES (?, ?, ?, ?, ?, ?, ?) " + STOP_UPDATE;
        boolean auto = con.getAutoCommit();
        con.setAutoCommit(false);
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            int n = 0;
            for (StopRow st : list) {
                ps.setString(1, st.id);
                ps.setString(2, st.name);
                ps.setBigDecimal(3, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", st.lat)));
                ps.setBigDecimal(4, new java.math.BigDecimal(String.format(Locale.ROOT, "%.7f", st.lng)));
                ps.setString(5, st.cityCode);
                ps.setString(6, st.cityName);
                if (st.collectedAt == null) ps.setNull(7, Types.DATE); else ps.setDate(7, java.sql.Date.valueOf(st.collectedAt));
                ps.addBatch();
                if (++n % 2000 == 0) { ps.executeBatch(); System.out.printf("\r  bus_stops 저장 중 %,d / %,d", n, list.size()); }
            }
            ps.executeBatch();
            con.commit();
            System.out.printf("\r✔ bus_stops 저장 완료 %,d곳%n", n);
        } catch (SQLException e) {
            con.rollback();
            System.err.println("\n✘ bus_stops 저장 실패 → 롤백했어요");
            throw e;
        } finally {
            con.setAutoCommit(auto);
        }
    }

    static void writeStopInserts(BufferedWriter w, List<StopRow> list) throws IOException {
        for (int i = 0; i < list.size(); i += BATCH) {
            w.write("INSERT INTO bus_stops (" + STOP_COLS + ") VALUES\n");
            List<StopRow> part = list.subList(i, Math.min(i + BATCH, list.size()));
            for (int j = 0; j < part.size(); j++) {
                StopRow st = part.get(j);
                w.write(String.format(Locale.ROOT, "(%s, %s, %.7f, %.7f, %s, %s, %s)", q(st.id), q(st.name), st.lat, st.lng,
                        q(st.cityCode), q(st.cityName), q(st.collectedAt)) + (j == part.size() - 1 ? "\n" : ",\n"));
            }
            w.write(STOP_UPDATE + ";\n");
        }
    }

    static final String[][] ACCESS_COLUMNS = {
            {"sido", "VARCHAR(20) NULL COMMENT '시/도 (짧은 이름: 서울 · 전남광주)' AFTER address"},
            {"sigungu", "VARCHAR(30) NULL COMMENT '시/군/구 (목포시 · 무안군)' AFTER sido"},
            {"nearest_stop_id", "VARCHAR(30) NULL COMMENT '가장 가까운 버스 정류장' AFTER longitude"},
            {"nearest_stop_m", "INT NULL COMMENT '가장 가까운 정류장까지 직선거리(m)' AFTER nearest_stop_id"},
            {"stops_500m", "SMALLINT NULL COMMENT '반경 500m 안 정류장 수' AFTER nearest_stop_m"},
    };

    /** 지역 · 접근성 칼럼 · 인덱스 · FK 가 없으면 추가 (db/patch_bus_transit.sql 과 같은 내용, 여러 번 실행해도 안전) */
    static void ensureAccessColumns(Connection con) throws SQLException {
        try (Statement st = con.createStatement()) {
            for (String t : new String[]{"places", "hospitals", "pet_hotels"}) {
                for (String[] c : ACCESS_COLUMNS) {
                    if (!columnExists(con, t, c[0])) {
                        st.execute("ALTER TABLE " + t + " ADD COLUMN " + c[0] + " " + c[1]);
                        System.out.println("  + 칼럼 추가: " + t + "." + c[0]);
                    }
                }
                if (!indexExists(con, t, "idx_" + t + "_region")) st.execute("ALTER TABLE " + t + " ADD INDEX idx_" + t + "_region (sido, sigungu)");
                if (t.equals("places") && !indexExists(con, t, "idx_places_stop_m")) st.execute("ALTER TABLE places ADD INDEX idx_places_stop_m (nearest_stop_m)");
                if (!constraintExists(con, t, "fk_" + t + "_nearest_stop")) {
                    st.execute("ALTER TABLE " + t + " ADD CONSTRAINT fk_" + t + "_nearest_stop FOREIGN KEY (nearest_stop_id) "
                            + "REFERENCES bus_stops(stop_id) ON DELETE SET NULL ON UPDATE CASCADE");
                }
            }
        }
    }

    /** 모든 장소 · 병원 · 호텔의 지역과 가장 가까운 정류장을 다시 계산해서 UPDATE (정류장이 없으면 지역만) */
    static void updateAccess(Connection con) throws SQLException {
        List<StopRow> stops = new ArrayList<>();
        try (Statement st = con.createStatement(); ResultSet rs = st.executeQuery("SELECT stop_id, name, latitude, longitude FROM bus_stops")) {
            while (rs.next()) {
                StopRow s = new StopRow();
                s.id = rs.getString(1); s.name = rs.getString(2);
                s.lat = rs.getBigDecimal(3).doubleValue(); s.lng = rs.getBigDecimal(4).doubleValue();
                stops.add(s);
            }
        }
        StopIndex idx = stops.isEmpty() ? null : new StopIndex(stops);
        if (idx == null) System.out.println("※ bus_stops 가 비어 있어 지역만 채워요. --bus-stops 로 정류장을 넣으면 가까운 정류장도 계산해요.");
        String[][] targets = {{"places", "place_id"}, {"hospitals", "hospital_id"}, {"pet_hotels", "hotel_id"}};
        boolean auto = con.getAutoCommit();
        con.setAutoCommit(false);
        try {
            for (String[] t : targets) {
                List<Object[]> rows = new ArrayList<>();
                try (Statement st = con.createStatement();
                     ResultSet rs = st.executeQuery("SELECT " + t[1] + ", address, latitude, longitude FROM " + t[0])) {
                    while (rs.next()) rows.add(new Object[]{rs.getLong(1), rs.getString(2), rs.getBigDecimal(3).doubleValue(), rs.getBigDecimal(4).doubleValue()});
                }
                String sql = idx == null
                        ? "UPDATE " + t[0] + " SET sido = ?, sigungu = ? WHERE " + t[1] + " = ?"
                        : "UPDATE " + t[0] + " SET sido = ?, sigungu = ?, nearest_stop_id = ?, nearest_stop_m = ?, stops_500m = ? WHERE " + t[1] + " = ?";
                int n = 0, near300 = 0;
                try (PreparedStatement ps = con.prepareStatement(sql)) {
                    for (Object[] r : rows) {
                        String[] reg = region((String) r[1]);
                        ps.setString(1, reg[0]);
                        ps.setString(2, reg[1]);
                        if (idx == null) {
                            ps.setLong(3, (Long) r[0]);
                        } else {
                            StopIndex.Near near = idx.near((Double) r[2], (Double) r[3]);
                            ps.setString(3, near.stop == null ? null : near.stop.id);
                            if (near.meters == null) ps.setNull(4, Types.INTEGER); else ps.setInt(4, near.meters);
                            ps.setInt(5, near.within500);
                            ps.setLong(6, (Long) r[0]);
                            if (near.meters != null && near.meters <= 300) near300++;
                        }
                        ps.addBatch();
                        if (++n % BATCH == 0) ps.executeBatch();
                    }
                    ps.executeBatch();
                }
                con.commit();
                System.out.printf("✔ %s 지역%s 계산 %,d곳%s%n", t[0], idx == null ? "" : " · 가까운 정류장", n,
                        idx == null ? "" : String.format(" (정류장 300m 이내 %,d곳)", near300));
            }
        } catch (SQLException e) {
            con.rollback();
            System.err.println("\n✘ 지역 · 정류장 계산 저장 실패 → 롤백했어요");
            throw e;
        } finally {
            con.setAutoCommit(auto);
        }
    }

    /** 주소 → {시/도 짧은 이름, 시/군/구} — 백엔드 Region.parse 와 같은 규칙 */
    static final Map<String, String> SIDO_ALIAS = new HashMap<>();
    static {
        String[][] a = {
                {"서울", "서울특별시", "서울시", "서울"}, {"부산", "부산광역시", "부산시", "부산"}, {"대구", "대구광역시", "대구시", "대구"},
                {"인천", "인천광역시", "인천시", "인천"}, {"대전", "대전광역시", "대전시", "대전"},
                {"울산", "울산광역시", "울산시", "울산"}, {"세종", "세종특별자치시", "세종시", "세종"}, {"경기", "경기도", "경기"},
                {"강원", "강원특별자치도", "강원도", "강원"}, {"충북", "충청북도", "충북"}, {"충남", "충청남도", "충남"},
                {"전북", "전북특별자치도", "전라북도", "전북"}, {"경북", "경상북도", "경북"},
                // 2026-07-01 전남 · 광주 통합 → 예전 주소도 같은 지역으로
                {"전남광주", "전남광주통합특별시", "전남광주특별시", "광주특별시", "전남광주", "전라남도", "전남", "광주광역시", "광주"},
                {"경남", "경상남도", "경남"}, {"제주", "제주특별자치도", "제주도", "제주"}};
        for (String[] row : a) for (int i = 1; i < row.length; i++) SIDO_ALIAS.put(row[i], row[0]);
    }

    static String[] region(String address) {
        if (address == null) return new String[]{null, null};
        String[] t = address.trim().split("\\s+");
        String sido = t.length > 0 ? SIDO_ALIAS.get(t[0]) : null;
        if (sido == null) return new String[]{null, null};
        if (sido.equals("세종")) return new String[]{sido, "세종시"};
        String second = t.length > 1 ? t[1] : "";
        return new String[]{sido, second.endsWith("시") || second.endsWith("군") || second.endsWith("구") ? second : null};
    }

    // ------------------------------------------------------------------ --sql-out
    static void writeSqlFile(Path out, List<Biz> hospitals, List<Biz> hotels, List<PlaceRow> places, List<StopRow> stops) throws IOException {
        try (BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            w.write("-- 펫플래닛 공공데이터 (PublicDataLoader --sql-out 으로 생성)\n");
            w.write("-- 먼저 db/patch_be2_public_data.sql · db/patch_bus_transit.sql 을 실행해 칼럼 · 버스 테이블을 추가해 주세요.\n");
            w.write("-- ※ 가까운 정류장 계산(--access)은 SQL 파일로 만들 수 없어요. 적재 후 적재기를 --access 로 한 번 실행하세요.\n");
            w.write("SET NAMES utf8mb4;\nSTART TRANSACTION;\n");
            writeInserts(w, hospitals, true);
            writeInserts(w, hotels, false);
            if (!places.isEmpty()) writePlaceInserts(w, places);
            if (!stops.isEmpty()) writeStopInserts(w, stops);
            w.write("COMMIT;\n");
        }
        System.out.println("✔ SQL 파일 저장: " + out.toAbsolutePath());
    }

    static void writeInserts(BufferedWriter w, List<Biz> list, boolean hospital) throws IOException {
        for (int i = 0; i < list.size(); i += BATCH) {
            w.write(hospital ? "INSERT INTO hospitals (" + HOSPITAL_COLS + ") VALUES\n"
                             : "INSERT INTO pet_hotels (" + HOTEL_COLS + ") VALUES\n");
            List<Biz> part = list.subList(i, Math.min(i + BATCH, list.size()));
            for (int j = 0; j < part.size(); j++) {
                Biz b = part.get(j);
                String row = String.format(Locale.ROOT, "(%s, %s, %s, %s, %.7f, %.7f",
                        q(b.licenseNo), q(b.name), q(b.address), q(b.phone), b.lat, b.lng)
                        + (hospital ? ", " + q(b.hours) : "") + ")";
                w.write(row + (j == part.size() - 1 ? "\n" : ",\n"));
            }
            w.write((hospital ? HOSPITAL_UPDATE : HOTEL_UPDATE) + ";\n");
        }
    }

    static String q(String s) {
        if (s == null) return "NULL";
        return "'" + s.replace("\\", "\\\\").replace("'", "''") + "'";
    }

    // ------------------------------------------------------------------ dry-run 출력
    static void printSamples(String label, List<Biz> list) {
        boolean anyHours = list.stream().anyMatch(b -> b.hours != null);
        System.out.println("---- " + label + " 예시 5개" + (anyHours ? " (영업시간 있는 곳)" : ""));
        list.stream().filter(b -> !anyHours || b.hours != null).limit(5).forEach(b -> System.out.printf(
                "  [%s] %s | %s | %s | %.7f, %.7f%s%n",
                b.licenseNo, b.name, b.address, b.phone, b.lat, b.lng,
                b.hours == null ? "" : " | " + b.hours + "  (← " + b.matchedKcisaName + ")"));
    }

    // ------------------------------------------------------------------ CSV (따옴표·줄바꿈 처리, 인코딩 자동 판별)
    static final class Csv {
        static List<String[]> read(Path p) throws IOException {
            byte[] bytes = Files.readAllBytes(p);
            String text = decode(bytes);
            List<String[]> rows = new ArrayList<>();
            List<String> cur = new ArrayList<>();
            StringBuilder sb = new StringBuilder();
            boolean inQ = false;
            for (int i = 0; i < text.length(); i++) {
                char ch = text.charAt(i);
                if (inQ) {
                    if (ch == '"') {
                        if (i + 1 < text.length() && text.charAt(i + 1) == '"') { sb.append('"'); i++; }
                        else inQ = false;
                    } else sb.append(ch);
                } else if (ch == '"') inQ = true;
                else if (ch == ',') { cur.add(sb.toString()); sb.setLength(0); }
                else if (ch == '\n' || ch == '\r') {
                    if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                    cur.add(sb.toString()); sb.setLength(0);
                    if (!(cur.size() == 1 && cur.get(0).isEmpty())) rows.add(cur.toArray(new String[0]));
                    cur = new ArrayList<>();
                } else sb.append(ch);
            }
            if (sb.length() > 0 || !cur.isEmpty()) { cur.add(sb.toString()); rows.add(cur.toArray(new String[0])); }
            return rows;
        }

        /** UTF-8(BOM 포함)이면 UTF-8, 아니면 공공데이터에 흔한 CP949(MS949) */
        static String decode(byte[] b) throws CharacterCodingException {
            if (b.length >= 3 && (b[0] & 0xFF) == 0xEF && (b[1] & 0xFF) == 0xBB && (b[2] & 0xFF) == 0xBF)
                return new String(b, 3, b.length - 3, StandardCharsets.UTF_8);
            try {
                return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .decode(java.nio.ByteBuffer.wrap(b)).toString();
            } catch (CharacterCodingException e) {
                return new String(b, Charset.forName("MS949"));
            }
        }

        static Map<String, Integer> header(String[] h) {
            Map<String, Integer> m = new HashMap<>();
            for (int i = 0; i < h.length; i++) m.put(h[i].trim(), i);
            return m;
        }
    }

    static int col(Map<String, Integer> h, String name) {
        Integer i = h.get(name);
        if (i == null) throw new IllegalArgumentException("CSV 에 '" + name + "' 칼럼이 없어요. 맞는 파일인지 확인해 주세요. 헤더: " + h.keySet());
        return i;
    }

    /** 후보 이름 중 처음 찾은 칼럼. required 인데 없으면 헤더를 보여 주며 멈춰요 */
    static int colAny(Map<String, Integer> h, boolean required, String... names) {
        for (String n : names) { Integer i = h.get(n); if (i != null) return i; }
        if (required) throw new IllegalArgumentException("CSV 에 " + Arrays.toString(names) + " 중 하나의 칼럼이 필요해요. 헤더: " + h.keySet());
        return -1;
    }

    static String get(String[] r, int i) { return i < r.length ? r[i].trim() : ""; }
    static String cut(String s, int n) { return s == null ? null : (s.length() <= n ? s : s.substring(0, n)); }

    static Map<String, String> parseArgs(String[] argv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < argv.length; i++) {
            if (!argv[i].startsWith("--")) continue;
            String k = argv[i].substring(2);
            if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) m.put(k, argv[++i]);
            else m.put(k, "true");
        }
        return m;
    }
}
