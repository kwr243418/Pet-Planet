package com.petplanet.review;

import com.petplanet.common.ApiException;
import com.petplanet.common.Errors;
import com.petplanet.common.Paging;
import com.petplanet.common.Rs;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 통합 리뷰 (reviews) — 장소·상품·병원을 한 테이블에 target_type + target_id 로 저장 (docs/04 §6, docs/05 §6)
 * - 1인 1대상 1리뷰: UNIQUE(user_id, target_type, target_id)
 * - 작성 자격: 병원 = 그 병원 예약이 COMPLETED, 상품 = 그 상품이 든 주문이 DELIVERED (장소는 누구나)
 */
@Service
public class ReviewService {

    private static final Set<String> TYPES = Set.of("PLACE", "PRODUCT", "HOSPITAL");
    private static final int MIN_LEN = 10;
    private static final int MAX_LEN = 500;

    public record Review(long reviewId, long userId, String userName, String petName, String petBreed, Double petWeight,
                         String visitDate, String targetType, long targetId, String targetName, int rating, String content,
                         String createdAt, String updatedAt, boolean mine) {
    }

    public record Summary(double avgRating, long reviewCount, Map<String, Long> distribution) {
    }

    public record ReviewPage(Summary summary, List<Review> content, int page, int size, long totalElements, boolean hasNext) {
    }

    public record ReviewInput(String targetType, Long targetId, Integer rating, String content, Long petId) {
    }

    public record Eligibility(String targetType, long targetId, boolean allowed, boolean alreadyReviewed, String reason) {
    }

    /**
     * 리뷰 + 작성자 이름 + 함께한 반려동물(리뷰의 pet_id, 없으면 작성자의 대표 반려동물)
     * + 병원 리뷰면 방문일(그 병원 이용완료 예약 중 가장 최근) + 대상 이름
     */
    private static final String SELECT = """
            SELECT r.review_id, r.user_id, u.name AS user_name, r.target_type, r.target_id, r.rating, r.content,
                   r.created_at, r.updated_at,
                   pt.name AS pet_name, pt.breed AS pet_breed, pt.weight AS pet_weight,
                   CASE WHEN r.target_type = 'HOSPITAL' THEN
                        (SELECT DATE(MAX(hr.reservation_date)) FROM hospital_reservations hr
                          WHERE hr.user_id = r.user_id AND hr.hospital_id = r.target_id AND hr.status = 'COMPLETED')
                   END AS visit_date,
                   CASE r.target_type
                        WHEN 'PLACE'    THEN (SELECT name FROM places    WHERE place_id    = r.target_id)
                        WHEN 'PRODUCT'  THEN (SELECT name FROM products  WHERE product_id  = r.target_id)
                        WHEN 'HOSPITAL' THEN (SELECT name FROM hospitals WHERE hospital_id = r.target_id)
                   END AS target_name
            FROM reviews r
            JOIN users u ON u.user_id = r.user_id
            LEFT JOIN pets pt ON pt.pet_id = COALESCE(r.pet_id, (SELECT MIN(p2.pet_id) FROM pets p2 WHERE p2.user_id = r.user_id))
            """;

    private static RowMapper<Review> mapper(long me) {
        return (rs, i) -> new Review(
                rs.getLong("review_id"), rs.getLong("user_id"), rs.getString("user_name"),
                rs.getString("pet_name"), rs.getString("pet_breed"), Rs.dbl(rs, "pet_weight"), Rs.isoDate(rs, "visit_date"),
                rs.getString("target_type"), rs.getLong("target_id"), rs.getString("target_name"),
                rs.getInt("rating"), rs.getString("content"),
                Rs.isoDateTime(rs, "created_at"), Rs.isoDateTime(rs, "updated_at"), rs.getLong("user_id") == me);
    }

    private final NamedParameterJdbcTemplate jdbc;

    public ReviewService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static String type(String t) {
        String v = t == null || t.isBlank() ? "PLACE" : t.trim().toUpperCase();
        if (!TYPES.contains(v)) throw ApiException.validation("targetType", "리뷰 대상은 PLACE, PRODUCT, HOSPITAL 중 하나예요.");
        return v;
    }

    /** GET /reviews — 요약(평균·개수·별점 분포) + 페이지 */
    public ReviewPage list(String targetType, long targetId, String sort, Integer page, Integer size, long me) {
        String t = type(targetType);
        Paging paging = Paging.of(page, size, 4, 50);
        MapSqlParameterSource p = new MapSqlParameterSource("t", t).addValue("id", targetId);

        Map<String, Long> dist = new LinkedHashMap<>();
        for (int s = 1; s <= 5; s++) dist.put(String.valueOf(s), 0L);
        jdbc.query("SELECT rating, COUNT(*) AS cnt FROM reviews WHERE target_type = :t AND target_id = :id GROUP BY rating", p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> dist.put(String.valueOf(rs.getInt("rating")), rs.getLong("cnt")));
        long count = dist.values().stream().mapToLong(Long::longValue).sum();
        long sum = 0;
        for (Map.Entry<String, Long> e : dist.entrySet()) sum += Integer.parseInt(e.getKey()) * e.getValue();
        double avg = count == 0 ? 0 : Math.round(sum * 10.0 / count) / 10.0;

        String orderBy = "rating_desc".equals(sort) || "rating".equals(sort)
                ? "r.rating DESC, r.created_at DESC, r.review_id DESC"
                : "r.created_at DESC, r.review_id DESC";
        p.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Review> content = jdbc.query(SELECT + " WHERE r.target_type = :t AND r.target_id = :id ORDER BY " + orderBy
                + " LIMIT :limit OFFSET :offset", p, mapper(me));
        boolean hasNext = (long) (paging.page() + 1) * paging.size() < count;
        return new ReviewPage(new Summary(avg, count, dist), content, paging.page(), paging.size(), count, hasNext);
    }

    public Review get(long reviewId, long me) {
        List<Review> rows = jdbc.query(SELECT + " WHERE r.review_id = :id", new MapSqlParameterSource("id", reviewId), mapper(me));
        if (rows.isEmpty()) throw ApiException.notFound("REVIEW_NOT_FOUND", "리뷰를 찾을 수 없어요.");
        return rows.get(0);
    }

    private static void validateBody(Integer rating, String content) {
        Errors errors = new Errors();
        errors.check(rating != null && rating >= 1 && rating <= 5, "rating", "별점을 선택해 주세요.");
        int len = content == null ? 0 : content.trim().length();
        if (len < MIN_LEN) errors.add("content", "리뷰는 " + MIN_LEN + "자 이상 작성해 주세요.");
        else if (len > MAX_LEN) errors.add("content", "리뷰는 " + MAX_LEN + "자 이내로 작성해 주세요.");
        errors.throwIfAny();
    }

    /** POST /reviews */
    @Transactional
    public Review create(long me, ReviewInput in) {
        if (in == null) throw ApiException.validation("targetId", "리뷰 정보가 필요해요.");
        String t = type(in.targetType());
        if (in.targetId() == null) throw ApiException.validation("targetId", "리뷰할 대상을 골라 주세요.");
        long targetId = in.targetId();
        validateBody(in.rating(), in.content());
        ensureTarget(t, targetId);

        String notAllowed = notAllowedReason(me, t, targetId);
        if (notAllowed != null) throw ApiException.forbidden("REVIEW_NOT_ALLOWED", notAllowed);
        if (alreadyReviewed(me, t, targetId)) throw duplicate(t);

        Long petId = in.petId();
        if (petId != null) {
            Long owner = jdbc.query("SELECT user_id FROM pets WHERE pet_id = :id", new MapSqlParameterSource("id", petId),
                    rs -> rs.next() ? rs.getLong(1) : null);
            if (owner == null || owner != me) throw ApiException.forbidden("내 반려동물만 선택할 수 있어요.");
        } else if ("HOSPITAL".equals(t)) {
            // 병원 리뷰는 이용완료 예약의 반려동물 (리뷰 카드의 품종·체중)
            petId = jdbc.query("""
                    SELECT pet_id FROM hospital_reservations
                    WHERE user_id = :me AND hospital_id = :id AND status = 'COMPLETED' AND pet_id IS NOT NULL
                    ORDER BY reservation_date DESC LIMIT 1
                    """, new MapSqlParameterSource("me", me).addValue("id", targetId), rs -> rs.next() ? rs.getLong(1) : null);
        }

        KeyHolder key = new GeneratedKeyHolder();
        try {
            jdbc.update("""
                    INSERT INTO reviews (user_id, target_type, target_id, pet_id, rating, content)
                    VALUES (:me, :t, :id, :petId, :rating, :content)
                    """, new MapSqlParameterSource("me", me).addValue("t", t).addValue("id", targetId).addValue("petId", petId)
                    .addValue("rating", in.rating()).addValue("content", in.content().trim()), key, new String[]{"review_id"});
        } catch (DuplicateKeyException e) {
            throw duplicate(t);
        }
        return get(key.getKey().longValue(), me);
    }

    private static ApiException duplicate(String t) {
        String what = switch (t) {
            case "PRODUCT" -> "이 상품";
            case "HOSPITAL" -> "이 병원";
            default -> "이 장소";
        };
        return ApiException.conflict("DUPLICATE_REVIEW", what + "에는 이미 리뷰를 남기셨어요. 기존 리뷰를 수정해 주세요.");
    }

    /** PUT /reviews/{id} — 본인만 */
    public Review update(long me, long reviewId, Integer rating, String content) {
        own(me, reviewId);
        validateBody(rating, content);
        jdbc.update("UPDATE reviews SET rating = :rating, content = :content WHERE review_id = :id",
                new MapSqlParameterSource("rating", rating).addValue("content", content.trim()).addValue("id", reviewId));
        return get(reviewId, me);
    }

    /** DELETE /reviews/{id} — 본인만 */
    public void delete(long me, long reviewId) {
        own(me, reviewId);
        jdbc.update("DELETE FROM reviews WHERE review_id = :id", new MapSqlParameterSource("id", reviewId));
    }

    private void own(long me, long reviewId) {
        Review r = get(reviewId, me);
        if (r.userId() != me) throw ApiException.forbidden("내가 쓴 리뷰만 수정·삭제할 수 있어요.");
    }

    /** GET /users/me/reviews — targetType 을 빼면 전체 (S08 통합 리뷰) */
    public List<Review> mine(long me, String targetType) {
        MapSqlParameterSource p = new MapSqlParameterSource("me", me);
        String where = " WHERE r.user_id = :me";
        if (targetType != null && !targetType.isBlank()) {
            where += " AND r.target_type = :t";
            p.addValue("t", type(targetType));
        }
        return jdbc.query(SELECT + where + " ORDER BY r.created_at DESC, r.review_id DESC", p, mapper(me));
    }

    /** GET /reviews/eligibility — 화면에서 [리뷰 쓰기] 버튼을 보여줄지 */
    public Eligibility eligibility(Long me, String targetType, long targetId) {
        String t = type(targetType);
        if (me == null) return new Eligibility(t, targetId, false, false, "로그인이 필요해요.");
        boolean already = alreadyReviewed(me, t, targetId);
        String reason = notAllowedReason(me, t, targetId);
        if (already) reason = "이미 리뷰를 남기셨어요.";
        return new Eligibility(t, targetId, reason == null, already, reason);
    }

    private boolean alreadyReviewed(long me, String t, long targetId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM reviews WHERE user_id = :me AND target_type = :t AND target_id = :id",
                new MapSqlParameterSource("me", me).addValue("t", t).addValue("id", targetId), Integer.class);
        return n != null && n > 0;
    }

    /** 작성 자격이 없으면 이유, 있으면 null */
    private String notAllowedReason(long me, String t, long targetId) {
        MapSqlParameterSource p = new MapSqlParameterSource("me", me).addValue("id", targetId);
        if ("HOSPITAL".equals(t)) {
            Integer n = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM hospital_reservations
                    WHERE user_id = :me AND hospital_id = :id AND status = 'COMPLETED'
                    """, p, Integer.class);
            return n != null && n > 0 ? null : "진료(이용)가 완료된 병원만 리뷰를 쓸 수 있어요.";
        }
        if ("PRODUCT".equals(t)) {
            Integer n = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM orders o
                    JOIN order_items oi ON oi.order_id = o.order_id
                    WHERE o.user_id = :me AND oi.product_id = :id AND o.status = 'DELIVERED'
                    """, p, Integer.class);
            return n != null && n > 0 ? null : "배송이 완료된 상품만 리뷰를 쓸 수 있어요.";
        }
        return null;
    }

    private void ensureTarget(String t, long id) {
        String sql = switch (t) {
            case "PRODUCT" -> "SELECT COUNT(*) FROM products WHERE product_id = :id";
            case "HOSPITAL" -> "SELECT COUNT(*) FROM hospitals WHERE hospital_id = :id";
            default -> "SELECT COUNT(*) FROM places WHERE place_id = :id";
        };
        Integer n = jdbc.queryForObject(sql, new MapSqlParameterSource("id", id), Integer.class);
        if (n == null || n == 0) {
            String code = switch (t) {
                case "PRODUCT" -> "PRODUCT_NOT_FOUND";
                case "HOSPITAL" -> "HOSPITAL_NOT_FOUND";
                default -> "PLACE_NOT_FOUND";
            };
            throw ApiException.notFound(code, "리뷰할 대상을 찾을 수 없어요.");
        }
    }
}
