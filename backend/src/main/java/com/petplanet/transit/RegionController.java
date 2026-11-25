package com.petplanet.transit;

import com.petplanet.common.ApiException;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** docs/09 §API — 지역별 탐색의 시/도 → 시/군/구 목록 (데이터가 있는 지역만, 개수 포함) */
@RestController
@RequestMapping("/api")
public class RegionController {

    private static final Map<String, String> TABLE = Map.of("place", "places", "hospital", "hospitals", "hotel", "pet_hotels");

    public record Sigungu(String name, long count) {
    }

    public record Sido(String sido, long count, List<Sigungu> sigungus) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public RegionController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** GET /api/regions?type=place|hospital|hotel (기본 place) */
    @GetMapping("/regions")
    public List<Sido> regions(@RequestParam(name = "type", required = false) String type) {
        String table = TABLE.get(type == null || type.isBlank() ? "place" : type);
        if (table == null) throw ApiException.validation("type", "type 은 place, hospital, hotel 중 하나예요.");

        Map<String, Long> total = new LinkedHashMap<>();
        Map<String, List<Sigungu>> children = new LinkedHashMap<>();
        // table 은 위 Map 에서만 골라서 SQL 에 직접 넣어도 안전해요
        jdbc.query("SELECT sido, sigungu, COUNT(*) AS cnt FROM " + table + " WHERE sido IS NOT NULL GROUP BY sido, sigungu",
                new MapSqlParameterSource(), (RowCallbackHandler) rs -> {
                    String sido = rs.getString("sido");
                    long cnt = rs.getLong("cnt");
                    total.merge(sido, cnt, Long::sum);
                    String sg = rs.getString("sigungu");
                    if (sg != null) children.computeIfAbsent(sido, k -> new ArrayList<>()).add(new Sigungu(sg, cnt));
                });

        Collator ko = Collator.getInstance(Locale.KOREAN);
        List<Sido> out = new ArrayList<>();
        for (String sido : Region.SIDO_ORDER) {
            Long cnt = total.get(sido);
            if (cnt == null) continue;
            List<Sigungu> list = new ArrayList<>(children.getOrDefault(sido, List.of()));
            list.sort(Comparator.comparing(Sigungu::name, ko));
            out.add(new Sido(sido, cnt, list));
        }
        return out;
    }
}
