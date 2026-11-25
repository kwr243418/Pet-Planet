package com.petplanet.place;

import com.petplanet.common.ApiException;
import com.petplanet.common.Csv;
import com.petplanet.common.PageResponse;
import com.petplanet.common.Paging;
import com.petplanet.common.Rs;
import com.petplanet.transit.BusAccess;
import com.petplanet.transit.Origin;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 장소 · 찜 — docs/04 §4 · §5, 지역 · 버스 접근성 docs/09 */
@Service
public class PlaceService {

    private static final List<String> SIZE_ORDER = List.of("SMALL", "MEDIUM", "LARGE");
    private static final Set<String> INDOOR_TYPES = Set.of("INDOOR", "OUTDOOR", "BOTH");
    private static final double MAX_RADIUS_KM = 5.0; // 내 위치 기준(지방)은 5km까지

    /** 목록 아이템 (상세는 phone·description·bookmarkCount 를 더 채워요). busAccess = 가장 가까운 버스 정류장 · 접근성 등급 */
    public record Place(long placeId, String name, Long categoryId, String categoryName, String address, String sido, String sigungu,
                        double lat, double lng, String maxSize, String indoorType, String imageUrl, double avgRating, long reviewCount,
                        boolean bookmarked, BusAccess busAccess, Double distanceKm,
                        String phone, String description, Long bookmarkCount, String bookmarkedAt) {
    }

    /** 기준점: 내 위치(lat · lng + radiusKm) 또는 지역(sido · sigungu). 둘 다 없으면 전체 */
    public record SearchQuery(Double lat, Double lng, Double radiusKm, String sido, String sigungu, Boolean nearStop,
                              String categoryIds, String sizes, String indoor, String keyword, String sort, Integer page, Integer size) {
    }

    /**
     * 장소 + 카테고리 + 평균 별점(리뷰 집계 서브쿼리) + 내 찜 여부.
     * 내 위치가 있으면 ST_Distance_Sphere 로 거리(km)를 계산하고, 가장 가까운 버스 정류장(bus_stops)을 붙여요.
     */
    private static String select(boolean withDistance, boolean detail, boolean bookmarkJoin) {
        return """
                SELECT p.place_id, p.name, p.category_id, c.name AS category_name, p.address, p.latitude, p.longitude,
                       p.allowed_size, p.indoor_outdoor, p.image_url,
                       COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count,
                       EXISTS (SELECT 1 FROM place_bookmarks b WHERE b.place_id = p.place_id AND b.user_id = :uid) AS bookmarked,
                """
                + BusAccess.columns("p") + "\n"
                + (withDistance ? ", ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:slng, :slat)) / 1000 AS distance_km\n" : ", NULL AS distance_km\n")
                + (detail ? ", p.phone, p.description, (SELECT COUNT(*) FROM place_bookmarks b2 WHERE b2.place_id = p.place_id) AS bookmark_count\n" : "")
                + (bookmarkJoin ? ", mb.created_at AS bookmarked_at\n" : "")
                + """
                FROM places p
                LEFT JOIN place_categories c ON c.category_id = p.category_id
                LEFT JOIN (SELECT target_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
                           FROM reviews WHERE target_type = 'PLACE' GROUP BY target_id) r ON r.target_id = p.place_id
                """ + BusAccess.join("p");
    }

    private static Place map(java.sql.ResultSet rs, boolean detail, boolean bookmarkJoin) throws java.sql.SQLException {
        return new Place(
                rs.getLong("place_id"), rs.getString("name"), Rs.longOrNull(rs, "category_id"), rs.getString("category_name"),
                rs.getString("address"), rs.getString("sido"), rs.getString("sigungu"),
                rs.getBigDecimal("latitude").doubleValue(), rs.getBigDecimal("longitude").doubleValue(),
                rs.getString("allowed_size"), rs.getString("indoor_outdoor"), rs.getString("image_url"),
                Rs.dblOrZero(rs, "avg_rating"), rs.getLong("review_count"), rs.getBoolean("bookmarked"),
                BusAccess.from(rs), Rs.km(rs, "distance_km"),
                detail ? rs.getString("phone") : null, detail ? rs.getString("description") : null,
                detail ? rs.getLong("bookmark_count") : null,
                bookmarkJoin ? Rs.isoDateTime(rs, "bookmarked_at") : null);
    }

    private final NamedParameterJdbcTemplate jdbc;

    public PlaceService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** GET /place-categories */
    public List<Map<String, Object>> categories() {
        return jdbc.query("SELECT category_id, name FROM place_categories ORDER BY category_id", new MapSqlParameterSource(),
                (rs, i) -> Map.<String, Object>of("categoryId", rs.getLong("category_id"), "name", rs.getString("name")));
    }

    /** GET /places — 내 위치 반경 또는 지역 + 정류장 300m + 카테고리 OR + 크기(모두 동반 가능) + 실내외 OR, 정렬·페이지 */
    public PageResponse<Place> search(SearchQuery q, long uid) {
        Paging paging = Paging.of(q.page(), q.size(), 10, 50);
        MapSqlParameterSource params = new MapSqlParameterSource("uid", uid);
        List<String> where = new ArrayList<>();

        Origin.Point origin = Origin.resolve(q.lat(), q.lng());
        if (origin != null) {
            double radius = q.radiusKm() == null || q.radiusKm() <= 0 ? 1.0 : Math.min(q.radiusKm(), MAX_RADIUS_KM);
            params.addValue("slat", origin.lat()).addValue("slng", origin.lng()).addValue("radiusM", radius * 1000);
            where.add("ST_Distance_Sphere(POINT(p.longitude, p.latitude), POINT(:slng, :slat)) <= :radiusM");
        }
        BusAccess.filters("p", q.sido(), q.sigungu(), q.nearStop(), where, params);

        List<Long> categoryIds = Csv.longs(q.categoryIds(), "categoryIds");
        if (!categoryIds.isEmpty()) {
            where.add("p.category_id IN (:categoryIds)");
            params.addValue("categoryIds", categoryIds);
        }

        // 고른 크기를 "모두" 데려갈 수 있는 곳 = 동반 가능 최대 크기가 고른 것 중 가장 큰 것 이상
        List<String> sizes = Csv.strings(q.sizes());
        if (!sizes.isEmpty()) {
            int need = 0;
            for (String s : sizes) {
                int idx = SIZE_ORDER.indexOf(s);
                if (idx < 0) throw ApiException.validation("sizes", "크기는 SMALL, MEDIUM, LARGE 중에서 골라 주세요.");
                need = Math.max(need, idx);
            }
            where.add("p.allowed_size IN (:allowedSizes)");
            params.addValue("allowedSizes", SIZE_ORDER.subList(need, SIZE_ORDER.size()));
        }

        List<String> indoor = Csv.strings(q.indoor());
        if (!indoor.isEmpty()) {
            for (String s : indoor) {
                if (!INDOOR_TYPES.contains(s)) throw ApiException.validation("indoor", "실내외는 INDOOR, OUTDOOR, BOTH 중에서 골라 주세요.");
            }
            where.add("p.indoor_outdoor IN (:indoor)");
            params.addValue("indoor", indoor);
        }

        String keyword = q.keyword() == null ? "" : q.keyword().trim();
        if (!keyword.isEmpty()) {
            where.add("(p.name LIKE CONCAT('%', :kw, '%') OR p.address LIKE CONCAT('%', :kw, '%'))");
            params.addValue("kw", keyword);
        }

        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        String sort = q.sort() == null || q.sort().isBlank() ? (origin != null ? "distance" : "reviews") : q.sort();
        String orderBy = switch (sort) {
            case "distance" -> origin != null ? "distance_km, p.place_id" : "review_count DESC, avg_rating DESC, p.place_id";
            case "rating" -> "avg_rating DESC, review_count DESC, p.place_id";
            case "transit" -> "p.nearest_stop_m IS NULL, p.nearest_stop_m, review_count DESC, p.place_id";
            default -> "review_count DESC, avg_rating DESC, p.place_id";
        };

        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM places p" + whereSql, params, Long.class);
        params.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Place> rows = jdbc.query(select(origin != null, false, false) + whereSql + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset",
                params, (rs, i) -> map(rs, false, false));
        return PageResponse.of(rows, paging, total == null ? 0 : total);
    }

    /** GET /places/{id} */
    public Place detail(long placeId, long uid) {
        List<Place> rows = jdbc.query(select(false, true, false) + " WHERE p.place_id = :placeId",
                new MapSqlParameterSource("uid", uid).addValue("placeId", placeId), (rs, i) -> map(rs, true, false));
        if (rows.isEmpty()) throw ApiException.notFound("PLACE_NOT_FOUND", "존재하지 않거나 삭제된 장소예요.");
        return rows.get(0);
    }

    /** 찜 — UNIQUE(user_id, place_id) 위반은 409 DUPLICATE_BOOKMARK */
    public Map<String, Object> bookmark(long userId, long placeId) {
        ensurePlace(placeId);
        try {
            jdbc.update("INSERT INTO place_bookmarks (user_id, place_id) VALUES (:uid, :pid)",
                    new MapSqlParameterSource("uid", userId).addValue("pid", placeId));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("DUPLICATE_BOOKMARK", "이미 찜한 장소예요.");
        }
        return bookmarkState(placeId, true);
    }

    /** 찜 해제 (없어도 200) */
    public Map<String, Object> unbookmark(long userId, long placeId) {
        jdbc.update("DELETE FROM place_bookmarks WHERE user_id = :uid AND place_id = :pid",
                new MapSqlParameterSource("uid", userId).addValue("pid", placeId));
        return bookmarkState(placeId, false);
    }

    private static Map<String, Object> bookmarkState(long placeId, boolean on) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("placeId", placeId);
        out.put("bookmarked", on);
        return out;
    }

    /** 내 찜 목록 (최근 순) */
    public List<Place> myBookmarks(long userId) {
        List<Place> rows = jdbc.query(select(false, false, true)
                        + " JOIN place_bookmarks mb ON mb.place_id = p.place_id AND mb.user_id = :uid ORDER BY mb.created_at DESC, mb.bookmark_id DESC",
                new MapSqlParameterSource("uid", userId), (rs, i) -> map(rs, false, true));
        return rows;
    }

    private void ensurePlace(long placeId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM places WHERE place_id = :id", new MapSqlParameterSource("id", placeId), Integer.class);
        if (n == null || n == 0) throw ApiException.notFound("PLACE_NOT_FOUND", "존재하지 않는 장소예요.");
    }
}
