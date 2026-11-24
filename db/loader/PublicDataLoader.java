import java.io.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 펫플래닛 공공데이터 적재기 (BE2) — 동물병원 · 펫호텔(동물위탁관리업)
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
        String hospitalCsv = a.get("hospital"), hotelCsv = a.get("hotel"), kcisaCsv = a.get("kcisa");
        if (hospitalCsv == null && hotelCsv == null) {
            System.err.println("사용법: java -cp <mysql-connector-j.jar> PublicDataLoader.java "
                    + "--hospital <동물병원.csv> --hotel <동물위탁관리업.csv> [--kcisa <한국문화정보원.csv>] "
                    + "[--dry-run | --sql-out out.sql]");
            System.exit(1);
        }

        KcisaIndex kcisa = kcisaCsv == null ? null : KcisaIndex.load(Path.of(kcisaCsv));
        if (kcisa == null) System.out.println("※ --kcisa 가 없어 영업시간·휴무일은 비워 둬요.");

        List<Biz> hospitals = hospitalCsv == null ? List.of()
                : readLicense(Path.of(hospitalCsv), "병원", kcisa, KCISA_HOSPITAL_CATS);
        List<Biz> hotels = hotelCsv == null ? List.of()
                : readLicense(Path.of(hotelCsv), "호텔", null, null);   // 호텔은 영업시간 저장 안 함

        if (a.containsKey("dry-run")) {
            printSamples("병원", hospitals);
            printSamples("호텔", hotels);
            System.out.println("dry-run 이라 DB 에는 저장하지 않았어요.");
            return;
        }
        if (a.containsKey("sql-out")) {
            writeSqlFile(Path.of(a.get("sql-out")), hospitals, hotels);
            return;
        }

        DbInfo db = askDbInfo(a);
        String url = "jdbc:mysql://" + db.host + ":" + db.port + "/" + db.name
                + "?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Seoul"
                + "&rewriteBatchedStatements=true&connectTimeout=10000";
        try (Connection con = DriverManager.getConnection(url, db.user, db.password)) {
            System.out.println("✔ DB 연결 성공: " + db.host + ":" + db.port + "/" + db.name);
            ensureColumns(con);
            if (!hospitals.isEmpty()) upsert(con, hospitals, true);
            if (!hotels.isEmpty()) upsert(con, hotels, false);
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
        }
    }

    // ------------------------------------------------------------------ --sql-out
    static void writeSqlFile(Path out, List<Biz> hospitals, List<Biz> hotels) throws IOException {
        try (BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            w.write("-- 펫플래닛 공공데이터 (PublicDataLoader --sql-out 으로 생성)\n");
            w.write("-- 먼저 db/patch_be2_public_data.sql 을 실행해 license_no 칼럼을 추가해 주세요.\n");
            w.write("SET NAMES utf8mb4;\nSTART TRANSACTION;\n");
            writeInserts(w, hospitals, true);
            writeInserts(w, hotels, false);
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
