package com.petplanet.facility;

import com.petplanet.common.ApiException;
import com.petplanet.common.Rs;
import com.petplanet.common.Times;
import com.petplanet.transit.BusAccess;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 동물병원 · 펫호텔 찜(hospital_bookmarks · hotel_bookmarks)과 마이페이지 "최근 예약한 병원 · 호텔".
 * 병원과 호텔은 테이블이 달라서 Kind 로 테이블 · 칼럼 이름을 골라요 (사용자 입력은 SQL 에 들어가지 않아요).
 */
@Service
public class FacilityService {

    public enum Kind {
        HOSPITAL("hospitals", "hospital_id", "hospital_bookmarks", "HOSPITAL_NOT_FOUND", "존재하지 않는 동물병원이에요.", "이미 찜한 병원이에요."),
        HOTEL("pet_hotels", "hotel_id", "hotel_bookmarks", "HOTEL_NOT_FOUND", "존재하지 않는 펫호텔이에요.", "이미 찜한 호텔이에요.");

        final String table, idColumn, bookmarkTable, notFoundCode, notFoundMessage, duplicateMessage;

        Kind(String table, String idColumn, String bookmarkTable, String notFoundCode, String notFoundMessage, String duplicateMessage) {
            this.table = table;
            this.idColumn = idColumn;
            this.bookmarkTable = bookmarkTable;
            this.notFoundCode = notFoundCode;
            this.notFoundMessage = notFoundMessage;
            this.duplicateMessage = duplicateMessage;
        }
    }

    /** 마이페이지 카드 한 장. reservable = 우리 사이트에서 예약 가능(병원: 제휴, 호텔: 객실 등록) */
    public record Facility(String kind, long id, String name, String address, String sido, String sigungu, boolean reservable,
                           BusAccess busAccess, String bookmarkedAt) {
    }

    /**
     * 최근 예약한 곳 (취소 제외). lastAt = 가장 최근 예약 일시(호텔은 체크인 날짜 00:00),
     * upcoming = 아직 오지 않은 승인대기 · 예약확정 예약이 있는지, bookmarked = 찜도 했는지
     */
    public record Recent(String kind, long id, String name, String sido, String sigungu, boolean reservable,
                         String lastAt, long count, boolean upcoming, boolean bookmarked) {
    }

    /** 내 찜 (병원 + 호텔, UNION ALL) */
    static final String BOOKMARKS_SQL = """
                SELECT * FROM (
                  SELECT 'HOSPITAL' AS kind, h.hospital_id AS id, h.name, h.address, (h.user_id IS NOT NULL) AS reservable,
                         b.created_at AS bookmarked_at, b.bookmark_id,
                """ + BusAccess.columns("h") + """

                  FROM hospital_bookmarks b JOIN hospitals h ON h.hospital_id = b.hospital_id""" + BusAccess.join("h") + """

                  WHERE b.user_id = :me
                  UNION ALL
                  SELECT 'HOTEL', ht.hotel_id, ht.name, ht.address,
                         EXISTS (SELECT 1 FROM room_types rt WHERE rt.hotel_id = ht.hotel_id),
                         b.created_at, b.bookmark_id,
                """ + BusAccess.columns("ht") + """

                  FROM hotel_bookmarks b JOIN pet_hotels ht ON ht.hotel_id = b.hotel_id""" + BusAccess.join("ht") + """

                  WHERE b.user_id = :me
                ) x
                ORDER BY bookmarked_at DESC, bookmark_id DESC
                """;

    /** 최근 예약 (병원 · 호텔별 GROUP BY 후 UNION ALL) */
    static final String RECENT_SQL = """
                SELECT * FROM (
                  SELECT 'HOSPITAL' AS kind, h.hospital_id AS id, h.name, h.sido, h.sigungu, (h.user_id IS NOT NULL) AS reservable,
                         MAX(hr.reservation_date) AS last_at, COUNT(*) AS cnt,
                         SUM(hr.status IN ('PENDING', 'CONFIRMED') AND hr.reservation_date >= :now) > 0 AS upcoming,
                         EXISTS (SELECT 1 FROM hospital_bookmarks b WHERE b.user_id = :me AND b.hospital_id = h.hospital_id) AS bookmarked
                  FROM hospital_reservations hr JOIN hospitals h ON h.hospital_id = hr.hospital_id
                  WHERE hr.user_id = :me AND hr.status <> 'CANCELLED'
                  GROUP BY h.hospital_id, h.name, h.sido, h.sigungu, h.user_id
                  UNION ALL
                  SELECT 'HOTEL', ht.hotel_id, ht.name, ht.sido, ht.sigungu,
                         EXISTS (SELECT 1 FROM room_types rt2 WHERE rt2.hotel_id = ht.hotel_id),
                         CAST(MAX(r.check_in_date) AS DATETIME), COUNT(*),
                         SUM(r.status IN ('PENDING', 'CONFIRMED') AND r.check_in_date >= :today) > 0,
                         EXISTS (SELECT 1 FROM hotel_bookmarks b WHERE b.user_id = :me AND b.hotel_id = ht.hotel_id)
                  FROM hotel_reservations r
                  JOIN room_types rt ON rt.room_id = r.room_id
                  JOIN pet_hotels ht ON ht.hotel_id = rt.hotel_id
                  WHERE r.user_id = :me AND r.status <> 'CANCELLED'
                  GROUP BY ht.hotel_id, ht.name, ht.sido, ht.sigungu
                ) x
                ORDER BY upcoming DESC, last_at DESC
                LIMIT :limit
                """;

    private final NamedParameterJdbcTemplate jdbc;

    public FacilityService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ 찜

    public Map<String, Object> bookmarkState(long me, Kind kind, long id) {
        ensureExists(kind, id);
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + kind.bookmarkTable + " WHERE user_id = :me AND " + kind.idColumn + " = :id",
                new MapSqlParameterSource("me", me).addValue("id", id), Integer.class);
        return state(kind, id, n != null && n > 0);
    }

    /** 찜 — UNIQUE(user_id, 대상 ID) 위반은 409 DUPLICATE_BOOKMARK */
    public Map<String, Object> bookmark(long me, Kind kind, long id) {
        ensureExists(kind, id);
        try {
            jdbc.update("INSERT INTO " + kind.bookmarkTable + " (user_id, " + kind.idColumn + ") VALUES (:me, :id)",
                    new MapSqlParameterSource("me", me).addValue("id", id));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("DUPLICATE_BOOKMARK", kind.duplicateMessage);
        }
        return state(kind, id, true);
    }

    /** 찜 해제 (없어도 200) */
    public Map<String, Object> unbookmark(long me, Kind kind, long id) {
        jdbc.update("DELETE FROM " + kind.bookmarkTable + " WHERE user_id = :me AND " + kind.idColumn + " = :id",
                new MapSqlParameterSource("me", me).addValue("id", id));
        return state(kind, id, false);
    }

    private static Map<String, Object> state(Kind kind, long id, boolean on) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind.name());
        out.put("id", id);
        out.put("bookmarked", on);
        return out;
    }

    private void ensureExists(Kind kind, long id) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + kind.table + " WHERE " + kind.idColumn + " = :id",
                new MapSqlParameterSource("id", id), Integer.class);
        if (n == null || n == 0) throw ApiException.notFound(kind.notFoundCode, kind.notFoundMessage);
    }

    /** 내가 찜한 병원 · 호텔 (최근에 찜한 순) — 두 찜 테이블을 UNION ALL */
    public List<Facility> myBookmarks(long me) {
        RowMapper<Facility> m = (rs, i) -> new Facility(rs.getString("kind"), rs.getLong("id"), rs.getString("name"),
                rs.getString("address"), rs.getString("sido"), rs.getString("sigungu"), rs.getBoolean("reservable"),
                BusAccess.from(rs), Rs.isoDateTime(rs, "bookmarked_at"));
        return jdbc.query(BOOKMARKS_SQL, new MapSqlParameterSource("me", me), m);
    }

    // ------------------------------------------------------------------ 최근 예약

    /**
     * 최근 예약한 병원 · 호텔 — 예약 테이블을 병원/호텔별로 GROUP BY 해서 횟수 · 마지막 일시를 구하고 UNION ALL.
     * 호텔 예약은 객실(room_types)을 거쳐 호텔로 묶어요.
     */
    public List<Recent> recent(long me, Integer limit) {
        int n = limit == null ? 6 : Math.max(1, Math.min(limit, 20));
        MapSqlParameterSource p = new MapSqlParameterSource("me", me)
                .addValue("now", Times.now()).addValue("today", Times.today()).addValue("limit", n);
        return jdbc.query(RECENT_SQL, p, (rs, i) -> new Recent(rs.getString("kind"), rs.getLong("id"), rs.getString("name"),
                rs.getString("sido"), rs.getString("sigungu"), rs.getBoolean("reservable"), Rs.isoDateTime(rs, "last_at"),
                rs.getLong("cnt"), rs.getBoolean("upcoming"), rs.getBoolean("bookmarked")));
    }
}
