package com.petplanet.transit;

import com.petplanet.common.ApiException;
import com.petplanet.transit.TagoClient.Arrival;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 버스 정류장 · 노선 · 실시간 도착 (docs/09 §API) */
@Service
public class BusService {

    private static final double M_PER_DEG_LAT = 111_320.0;
    private static final int MAX_RADIUS_M = 1_000;
    private static final long ARRIVAL_CACHE_MS = 30_000; // 같은 정류장은 30초 동안 다시 부르지 않아요 (API 호출량 절약)

    public record Stop(String stopId, String name, double lat, double lng, String cityCode, String cityName,
                       Integer distanceM, Integer walkMin, long routeCount) {
    }

    public record Route(String routeId, String routeNo, String routeName) {
    }

    /** status: OK · NO_KEY(인증키 미설정) · NO_CITY(도시코드 없음) · UNAVAILABLE(호출 실패) */
    public record Arrivals(String stopId, String stopName, String status, String message, String fetchedAt, List<Arrival> arrivals) {
    }

    private record Cached(long at, Arrivals value) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final TagoClient tago;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public BusService(NamedParameterJdbcTemplate jdbc, TagoClient tago) {
        this.jdbc = jdbc;
        this.tago = tago;
    }

    /** 좌표 반경 안 정류장, 가까운 순. 위·경도 범위로 먼저 좁히고(인덱스) 정확한 거리는 ST_Distance_Sphere */
    public List<Stop> nearby(Double lat, Double lng, Integer radiusM, Integer limit) {
        Origin.Point o = Origin.resolve(lat, lng);
        if (o == null) throw ApiException.validation("lat", "위치(lat, lng)가 필요해요.");
        int r = Math.max(50, Math.min(radiusM == null ? 500 : radiusM, MAX_RADIUS_M));
        int n = Math.max(1, Math.min(limit == null ? 5 : limit, 20));
        double dLat = r / M_PER_DEG_LAT;
        double dLng = r / (M_PER_DEG_LAT * Math.cos(Math.toRadians(o.lat())));
        MapSqlParameterSource p = new MapSqlParameterSource("lat", o.lat()).addValue("lng", o.lng()).addValue("r", r)
                .addValue("dLat", dLat).addValue("dLng", dLng).addValue("limit", n);
        return jdbc.query("""
                SELECT * FROM (
                    SELECT s.stop_id, s.name, s.latitude, s.longitude, s.city_code, s.city_name,
                           ROUND(ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(:lng, :lat))) AS dist_m,
                           (SELECT COUNT(DISTINCT brs.route_id) FROM bus_route_stops brs WHERE brs.stop_id = s.stop_id) AS route_count
                    FROM bus_stops s
                    WHERE s.latitude BETWEEN :lat - :dLat AND :lat + :dLat
                      AND s.longitude BETWEEN :lng - :dLng AND :lng + :dLng
                ) t
                WHERE t.dist_m <= :r
                ORDER BY t.dist_m, t.stop_id
                LIMIT :limit
                """, p, (rs, i) -> {
            int d = rs.getInt("dist_m");
            return new Stop(rs.getString("stop_id"), rs.getString("name"), rs.getBigDecimal("latitude").doubleValue(),
                    rs.getBigDecimal("longitude").doubleValue(), rs.getString("city_code"), rs.getString("city_name"),
                    d, BusAccess.walkMinutes(d), rs.getLong("route_count"));
        });
    }

    /** 이 정류장을 지나는 노선 (노선 데이터를 적재한 지역만) */
    public List<Route> routes(String stopId) {
        stop(stopId);
        return jdbc.query("""
                SELECT r.route_id, r.route_no, r.route_name
                FROM bus_route_stops brs
                JOIN bus_routes r ON r.route_id = brs.route_id
                WHERE brs.stop_id = :id
                GROUP BY r.route_id, r.route_no, r.route_name
                ORDER BY LENGTH(r.route_no), r.route_no
                """, new MapSqlParameterSource("id", stopId),
                (rs, i) -> new Route(rs.getString("route_id"), rs.getString("route_no"), rs.getString("route_name")));
    }

    /** 실시간 도착 정보 — TAGO API 를 대신 불러요 (인증키는 서버에만) */
    public Arrivals arrivals(String stopId) {
        Map<String, Object> s = stop(stopId);
        String name = (String) s.get("name");
        String cityCode = (String) s.get("city_code");
        Cached c = cache.get(stopId);
        if (c != null && System.currentTimeMillis() - c.at() < ARRIVAL_CACHE_MS) return c.value();

        Arrivals result;
        if (!tago.configured()) {
            result = new Arrivals(stopId, name, "NO_KEY", "실시간 도착정보 인증키가 아직 설정되지 않았어요.", now(), List.of());
        } else if (cityCode == null || cityCode.isBlank()) {
            result = new Arrivals(stopId, name, "NO_CITY", "이 정류장은 실시간 도착정보를 제공하지 않는 지역이에요.", now(), List.of());
        } else {
            try {
                result = new Arrivals(stopId, name, "OK", null, now(), tago.arrivals(cityCode, stopId));
            } catch (TagoClient.TagoException e) {
                result = new Arrivals(stopId, name, "UNAVAILABLE", "실시간 도착정보를 지금 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", now(), List.of());
            }
        }
        cache.put(stopId, new Cached(System.currentTimeMillis(), result));
        return result;
    }

    private Map<String, Object> stop(String stopId) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT stop_id, name, city_code FROM bus_stops WHERE stop_id = :id",
                new MapSqlParameterSource("id", stopId));
        if (rows.isEmpty()) throw ApiException.notFound("BUS_STOP_NOT_FOUND", "존재하지 않는 버스 정류장이에요.");
        return rows.get(0);
    }

    private static String now() {
        return OffsetDateTime.now(ZoneId.of("Asia/Seoul")).withNano(0).toString();
    }
}
