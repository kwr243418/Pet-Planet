package com.petplanet.station;

import com.petplanet.common.ApiException;
import com.petplanet.station.StationDirectory.StationRef;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** docs/04 §3 지하철역 · §4 장소 카테고리 */
@RestController
@RequestMapping("/api")
public class StationController {

    /** 이 역을 지나는 모든 호선 (환승 표시). LINES 는 MySQL 예약어라 line_codes 로 */
    private static final String SELECT = """
            SELECT s.station_id, s.name, s.line, s.seq, s.latitude, s.longitude,
                   (SELECT GROUP_CONCAT(s2.line ORDER BY s2.station_id SEPARATOR ',')
                      FROM stations s2 WHERE s2.name = s.name) AS line_codes
            FROM stations s
            """;

    private static final RowMapper<StationRef> MAPPER = (rs, i) -> {
        int seq = rs.getInt("seq");
        Integer seqOrNull = rs.wasNull() ? null : seq;
        String codes = rs.getString("line_codes");
        return new StationRef(rs.getLong("station_id"), rs.getString("name"), rs.getString("line"), seqOrNull,
                rs.getBigDecimal("latitude").doubleValue(), rs.getBigDecimal("longitude").doubleValue(),
                codes == null ? List.of() : Arrays.asList(codes.split(",")), null);
    };

    private final NamedParameterJdbcTemplate jdbc;

    public StationController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * ?line=2호선 → 노선도: 그 호선의 역을 seq 순서대로
     * ?keyword=홍대 → 역 이름 검색 (같은 이름은 한 번만), 최대 10개
     */
    @GetMapping("/stations")
    public List<StationRef> stations(@RequestParam(name = "line", required = false) String line,
                                     @RequestParam(name = "keyword", required = false) String keyword) {
        if (line != null && !line.isBlank()) {
            return jdbc.query(SELECT + " WHERE s.line = :line ORDER BY s.seq, s.station_id",
                    new MapSqlParameterSource("line", line.trim()), MAPPER);
        }
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.endsWith("역")) kw = kw.substring(0, kw.length() - 1);
        if (kw.isEmpty()) return List.of();
        // 역 이름으로 묶어서 이름마다 가장 먼저 등록된 행(MIN station_id) 하나만
        return jdbc.query(SELECT + """
                 WHERE s.station_id IN (
                     SELECT MIN(station_id) FROM stations
                     WHERE name LIKE CONCAT('%', :kw, '%')
                     GROUP BY name)
                 ORDER BY s.station_id
                 LIMIT 10
                """, new MapSqlParameterSource("kw", kw), MAPPER);
    }

    @GetMapping("/stations/{stationId}")
    public StationRef station(@PathVariable("stationId") long stationId) {
        List<StationRef> rows = jdbc.query(SELECT + " WHERE s.station_id = :id", new MapSqlParameterSource("id", stationId), MAPPER);
        if (rows.isEmpty()) throw ApiException.notFound("STATION_NOT_FOUND", "존재하지 않는 지하철역이에요.");
        return rows.get(0);
    }

    /** 카페 · 식당 · 숙소 · 운동장 */
    @GetMapping("/place-categories")
    public List<Map<String, Object>> placeCategories() {
        return jdbc.query("SELECT category_id, name FROM place_categories ORDER BY category_id", new MapSqlParameterSource(),
                (rs, i) -> Map.<String, Object>of("categoryId", rs.getLong("category_id"), "name", rs.getString("name")));
    }
}
