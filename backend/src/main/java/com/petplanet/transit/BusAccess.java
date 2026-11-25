package com.petplanet.transit;

import com.petplanet.common.ApiException;
import com.petplanet.common.Rs;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * 장소 · 병원 · 호텔의 대중교통 접근성 (가장 가까운 버스 정류장 + 등급).
 * 정류장 칼럼(nearest_stop_id · nearest_stop_m · stops_500m)은 적재기가 미리 계산해 두고, 여기서는 읽기만 해요.
 *
 * 등급 (docs/09):
 *   거리 점수  200m 이내 3 · 400m 이내 2 · 800m 이내 1 · 그 밖 0
 *   + 1점     정류장을 지나는 노선 5개 이상 (노선 정보가 아직 없으면 반경 500m 정류장 4곳 이상)
 *   4점 A · 3점 B · 2점 C · 그 아래 D
 */
public record BusAccess(String stopId, String stopName, Integer distanceM, Integer walkMin, Integer stops500m,
                        Integer routeCount, String grade, String gradeLabel) {

    /** 정류장 근처만 보기(?nearStop=true)의 기준 거리 */
    public static final int NEAR_STOP_M = 300;

    /** 도보 4.5km/h(분당 75m) · 길 우회 1.25배 */
    public static Integer walkMinutes(Integer meters) {
        return meters == null ? null : Math.max(1, (int) Math.ceil(meters * 1.25 / 75.0));
    }

    public static String grade(Integer meters, Integer stops500m, Integer routeCount) {
        if (meters == null) return "D";
        int pts = meters <= 200 ? 3 : meters <= 400 ? 2 : meters <= 800 ? 1 : 0;
        boolean wellServed = routeCount != null && routeCount > 0 ? routeCount >= 5 : stops500m != null && stops500m >= 4;
        if (pts > 0 && wellServed) pts++;
        return pts >= 4 ? "A" : pts == 3 ? "B" : pts == 2 ? "C" : "D";
    }

    public static String label(String grade) {
        return switch (grade) {
            case "A" -> "버스 정류장이 아주 가까워요";
            case "B" -> "버스로 가기 편해요";
            case "C" -> "정류장까지 조금 걸어요";
            default -> "버스보다 차량 이동을 추천해요";
        };
    }

    public static BusAccess of(String stopId, String stopName, Integer meters, Integer stops500m, Integer routeCount) {
        String g = grade(stopId == null ? null : meters, stops500m, routeCount);
        return new BusAccess(stopId, stopName, stopId == null ? null : meters, stopId == null ? null : walkMinutes(meters),
                stops500m, routeCount, g, label(g));
    }

    // ------------------------------------------------------------------ SQL 조각 (a = 테이블 별칭)

    /** SELECT 에 붙일 칼럼: 지역 + 가장 가까운 정류장 + 그 정류장을 지나는 노선 수 */
    public static String columns(String a) {
        return a + ".sido, " + a + ".sigungu, " + a + ".nearest_stop_id, " + a + ".nearest_stop_m, " + a + ".stops_500m, "
                + "bs.name AS stop_name, "
                + "(SELECT COUNT(DISTINCT brs.route_id) FROM bus_route_stops brs WHERE brs.stop_id = " + a + ".nearest_stop_id) AS stop_route_count";
    }

    public static String join(String a) {
        return " LEFT JOIN bus_stops bs ON bs.stop_id = " + a + ".nearest_stop_id";
    }

    /** 지역(sido · sigungu) · 정류장 300m 이내 필터를 where 에 더해요 */
    public static void filters(String a, String sido, String sigungu, Boolean nearStop, List<String> where, MapSqlParameterSource p) {
        if (sido != null && !sido.isBlank()) {
            String s = Region.normalizeSido(sido);
            if (s == null) throw ApiException.validation("sido", "시/도 이름을 확인해 주세요. (예: 전남, 서울)");
            where.add(a + ".sido = :sido");
            p.addValue("sido", s);
        }
        if (sigungu != null && !sigungu.isBlank()) {
            where.add(a + ".sigungu = :sigungu");
            p.addValue("sigungu", sigungu.trim());
        }
        if (Boolean.TRUE.equals(nearStop)) {
            where.add(a + ".nearest_stop_m <= :nearStopM");
            p.addValue("nearStopM", NEAR_STOP_M);
        }
    }

    /** 정류장 계산 전(적재기 --access 를 아직 안 돌림)이면 null */
    public static BusAccess from(ResultSet rs) throws SQLException {
        String stopId = rs.getString("nearest_stop_id");
        Integer stops = Rs.intOrNull(rs, "stops_500m");
        if (stopId == null && stops == null) return null;
        Long routes = Rs.longOrNull(rs, "stop_route_count");
        return of(stopId, rs.getString("stop_name"), Rs.intOrNull(rs, "nearest_stop_m"), stops, routes == null ? null : routes.intValue());
    }
}
