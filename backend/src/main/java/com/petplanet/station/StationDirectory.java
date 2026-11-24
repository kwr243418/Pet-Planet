package com.petplanet.station;

import com.petplanet.common.Geo;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 지하철역 캐시 (역은 141행 정도라 메모리에 두고 1분마다 새로 읽어요).
 * - 역 이름별 호선 목록(환승 표시용 lines)
 * - 병원·호텔처럼 place_stations 같은 매핑 테이블이 없는 곳의 "가장 가까운 역" 계산
 */
@Component
public class StationDirectory {

    private static final long TTL_MILLIS = 60_000;

    /** 역 1행 = 역 이름 + 호선 1개 */
    public record Station(long stationId, String stationName, String line, Integer seq, double lat, double lng) {
    }

    /** 응답용 역: 선택한 호선 행 + 이 역을 지나는 모든 호선 (+ 기준점에서의 거리) */
    public record StationRef(long stationId, String stationName, String line, Integer seq, double lat, double lng,
                             List<String> lines, Double distanceKm) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private volatile List<Station> cache = List.of();
    private volatile Map<String, List<String>> linesByName = Map.of();
    private volatile long loadedAt = 0;

    public StationDirectory(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public synchronized List<Station> all() {
        if (System.currentTimeMillis() - loadedAt > TTL_MILLIS || cache.isEmpty()) {
            List<Station> rows = jdbc.query(
                    "SELECT station_id, name, line, seq, latitude, longitude FROM stations ORDER BY station_id",
                    new MapSqlParameterSource(),
                    (rs, i) -> {
                        int seq = rs.getInt("seq");
                        Integer seqOrNull = rs.wasNull() ? null : seq;
                        return new Station(rs.getLong("station_id"), rs.getString("name"), rs.getString("line"), seqOrNull,
                                rs.getBigDecimal("latitude").doubleValue(), rs.getBigDecimal("longitude").doubleValue());
                    });
            Map<String, List<String>> lines = new LinkedHashMap<>();
            for (Station s : rows) lines.computeIfAbsent(s.stationName(), k -> new ArrayList<>()).add(s.line());
            cache = rows;
            linesByName = lines;
            loadedAt = System.currentTimeMillis();
        }
        return cache;
    }

    public List<String> linesOf(String stationName) {
        all();
        return linesByName.getOrDefault(stationName, List.of());
    }

    public StationRef ref(Station s, Double distanceKm) {
        return new StationRef(s.stationId(), s.stationName(), s.line(), s.seq(), s.lat(), s.lng(), linesOf(s.stationName()), distanceKm);
    }

    public Station find(long stationId) {
        for (Station s : all()) if (s.stationId() == stationId) return s;
        return null;
    }

    /** 좌표에서 가장 가까운 역 (maxKm 보다 멀면 null) — 병원·호텔 카드의 "○○역 0.4km" */
    public StationRef nearest(double lat, double lng, double maxKm) {
        Station best = null;
        double bestKm = Double.MAX_VALUE;
        for (Station s : all()) {
            double d = Geo.haversineKm(lat, lng, s.lat(), s.lng());
            if (d < bestKm) {
                bestKm = d;
                best = s;
            }
        }
        if (best == null || bestKm > maxKm) return null;
        return ref(best, Geo.round3(bestKm));
    }
}
