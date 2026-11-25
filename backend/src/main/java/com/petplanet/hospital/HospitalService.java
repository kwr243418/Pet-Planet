package com.petplanet.hospital;

import com.petplanet.common.ApiException;
import com.petplanet.common.Errors;
import com.petplanet.common.PageResponse;
import com.petplanet.common.Paging;
import com.petplanet.common.Rs;
import com.petplanet.common.Times;
import com.petplanet.pet.PetService;
import com.petplanet.pet.PetService.Pet;
import com.petplanet.reservation.ReservationPolicy;
import com.petplanet.transit.BusAccess;
import com.petplanet.transit.Origin;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 동물병원 · 진료 예약 (hospitals, hospital_reservations) — docs/05 §1 */
@Service
public class HospitalService {

    /** 진료 예약 시간: 10:00 ~ 17:30, 30분 단위, 점심시간 제외 (합의 [12]: 한 칸에 1건) */
    private static final LocalTime FIRST_SLOT = LocalTime.of(10, 0);
    private static final LocalTime LAST_SLOT = LocalTime.of(17, 30);
    private static final String DEFAULT_LUNCH = "13:00-14:00";

    public record Hospital(long hospitalId, String name, String address, String phone, double lat, double lng,
                           String operatingHours, String intro, List<String> departments, String lunchTime, boolean partner,
                           double avgRating, long reviewCount, String sido, String sigungu, BusAccess busAccess, Double distanceKm) {
    }

    public record Slot(String time, boolean available) {
    }

    public record AvailableTimes(long hospitalId, String date, List<Slot> slots) {
    }

    public record ReserveRequest(Long hospitalId, Long petId, String reservationDate) {
    }

    public record Reservation(long reservationId, String kind, long hospitalId, String hospitalName, Long petId, String petName,
                              String reservationDate, String status, String createdAt, boolean reviewed) {
    }

    public record StatusRequest(String status) {
    }

    private static final String SELECT = """
            SELECT h.hospital_id, h.user_id, h.name, h.address, h.phone, h.latitude, h.longitude, h.operating_hours,
                   h.intro, h.departments, h.lunch_time,
                   COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count,
            """ + BusAccess.columns("h") + "\n";

    private static final String FROM = """
            FROM hospitals h
            LEFT JOIN (SELECT target_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
                       FROM reviews WHERE target_type = 'HOSPITAL' GROUP BY target_id) r ON r.target_id = h.hospital_id
            """ + BusAccess.join("h");

    private final NamedParameterJdbcTemplate jdbc;
    private final PetService pets;
    private final ReservationPolicy policy;

    public HospitalService(NamedParameterJdbcTemplate jdbc, PetService pets, ReservationPolicy policy) {
        this.jdbc = jdbc;
        this.pets = pets;
        this.policy = policy;
    }

    private RowMapper<Hospital> mapper(boolean withDistance) {
        return (rs, i) -> {
            double lat = rs.getBigDecimal("latitude").doubleValue();
            double lng = rs.getBigDecimal("longitude").doubleValue();
            String deps = rs.getString("departments");
            List<String> departments = deps == null || deps.isBlank() ? List.of()
                    : Arrays.stream(deps.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            return new Hospital(rs.getLong("hospital_id"), rs.getString("name"), rs.getString("address"), rs.getString("phone"),
                    lat, lng, rs.getString("operating_hours"), rs.getString("intro"), departments, rs.getString("lunch_time"),
                    Rs.longOrNull(rs, "user_id") != null,
                    Rs.dblOrZero(rs, "avg_rating"), rs.getLong("review_count"),
                    rs.getString("sido"), rs.getString("sigungu"), BusAccess.from(rs), withDistance ? Rs.km(rs, "distance_km") : null);
        };
    }

    /**
     * GET /hospitals — 내 위치를 주면 가까운 순 (ST_Distance_Sphere), 아니면 제휴 병원 먼저.
     * 지역(sido · sigungu) · 버스 정류장 300m(nearStop) 필터, partner=true 면 예약을 받는 제휴 병원만.
     */
    public PageResponse<Hospital> list(Double lat, Double lng, Double radiusKm, String sido, String sigungu, Boolean nearStop,
                                       String keyword, Boolean partner, Integer page, Integer size) {
        Paging paging = Paging.of(page, size, 10, 50);
        MapSqlParameterSource p = new MapSqlParameterSource();
        List<String> where = new ArrayList<>();
        Origin.Point origin = Origin.resolve(lat, lng);
        if (origin != null) {
            p.addValue("slat", origin.lat()).addValue("slng", origin.lng());
            if (radiusKm != null && radiusKm > 0) {
                where.add("ST_Distance_Sphere(POINT(h.longitude, h.latitude), POINT(:slng, :slat)) <= :radiusM");
                p.addValue("radiusM", Math.min(radiusKm, 20.0) * 1000);
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            where.add("(h.name LIKE CONCAT('%', :kw, '%') OR h.address LIKE CONCAT('%', :kw, '%'))");
            p.addValue("kw", keyword.trim());
        }
        BusAccess.filters("h", sido, sigungu, nearStop, where, p);
        if (Boolean.TRUE.equals(partner)) where.add("h.user_id IS NOT NULL");
        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        String distance = origin != null ? ", ST_Distance_Sphere(POINT(h.longitude, h.latitude), POINT(:slng, :slat)) / 1000 AS distance_km\n" : "";
        String orderBy = origin != null ? "distance_km, h.hospital_id"
                : "(h.user_id IS NULL), (h.intro IS NULL), (h.nearest_stop_m IS NULL), h.nearest_stop_m, h.hospital_id"; // 지역: 제휴 → 정류장 가까운 순

        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM hospitals h" + whereSql, p, Long.class);
        p.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Hospital> rows = jdbc.query(SELECT + distance + FROM + whereSql + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset",
                p, mapper(origin != null));
        return PageResponse.of(rows, paging, total == null ? 0 : total);
    }

    public Hospital get(long hospitalId) {
        List<Hospital> rows = jdbc.query(SELECT + FROM + " WHERE h.hospital_id = :id", new MapSqlParameterSource("id", hospitalId), mapper(false));
        if (rows.isEmpty()) throw ApiException.notFound("HOSPITAL_NOT_FOUND", "존재하지 않는 동물병원이에요.");
        return rows.get(0);
    }

    /** 그날 시간 버튼 목록 — 같은 병원·같은 일시에 승인대기·예약확정 예약이 있으면 마감, 지난 시간도 막아요 */
    public AvailableTimes availableTimes(long hospitalId, String dateText) {
        Hospital h = get(hospitalId);
        LocalDate date = Times.parseDate(dateText);
        if (date == null) throw ApiException.validation("date", "날짜를 2026-11-20 모양으로 보내 주세요.");
        Set<String> taken = new HashSet<>(jdbc.queryForList("""
                SELECT TIME_FORMAT(reservation_date, '%H:%i') AS taken
                FROM hospital_reservations
                WHERE hospital_id = :id AND DATE(reservation_date) = :date AND status IN ('PENDING', 'CONFIRMED')
                """, new MapSqlParameterSource("id", hospitalId).addValue("date", date), String.class));
        LocalDateTime now = Times.now();
        List<Slot> slots = new ArrayList<>();
        for (LocalTime t : slotTimes(h.lunchTime())) {
            String hhmm = t.toString();
            boolean past = !LocalDateTime.of(date, t).isAfter(now);
            slots.add(new Slot(hhmm, !past && !taken.contains(hhmm)));
        }
        return new AvailableTimes(hospitalId, date.toString(), slots);
    }

    /** 10:00~17:30 30분 간격, 점심시간("13:00-14:00")과 겹치는 칸 제외 */
    static List<LocalTime> slotTimes(String lunch) {
        LocalTime[] range = parseRange(lunch == null || lunch.isBlank() ? DEFAULT_LUNCH : lunch);
        List<LocalTime> out = new ArrayList<>();
        for (LocalTime t = FIRST_SLOT; !t.isAfter(LAST_SLOT); t = t.plusMinutes(30)) {
            boolean inLunch = range != null && !t.isBefore(range[0]) && t.isBefore(range[1]);
            if (!inLunch) out.add(t);
        }
        return out;
    }

    private static LocalTime[] parseRange(String s) {
        try {
            String[] parts = s.replace("~", "-").split("-");
            return new LocalTime[]{LocalTime.parse(parts[0].trim()), LocalTime.parse(parts[1].trim())};
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * POST /hospital-reservations → PENDING
     * 트랜잭션 안에서 병원 행을 SELECT … FOR UPDATE 로 잠가서, 같은 병원에 동시에 들어온 신청을 한 줄로 세운 뒤
     * 같은 일시의 진행 중 예약이 있는지 확인하고 INSERT 해요. (동시에 눌러도 한 칸에 1건)
     */
    @Transactional
    public Reservation reserve(long me, ReserveRequest req) {
        Errors errors = new Errors();
        errors.check(req != null && req.hospitalId() != null, "hospitalId", "병원을 선택해 주세요.");
        errors.check(req != null && req.petId() != null, "petId", "예약할 반려동물을 선택해 주세요.");
        LocalDateTime when = req == null ? null : Times.parseDateTime(req.reservationDate());
        errors.check(when != null, "reservationDate", "예약 일시를 선택해 주세요.");
        errors.throwIfAny();

        Pet pet = pets.get(me, req.petId()); // 내 반려동물만 (아니면 403)
        List<String> lunch = jdbc.query("SELECT lunch_time FROM hospitals WHERE hospital_id = :id FOR UPDATE",
                new MapSqlParameterSource("id", req.hospitalId()), (rs, i) -> rs.getString("lunch_time"));
        if (lunch.isEmpty()) throw ApiException.notFound("HOSPITAL_NOT_FOUND", "존재하지 않는 동물병원이에요.");

        if (!when.isAfter(Times.now())) throw ApiException.validation("reservationDate", "지난 날짜·시간은 예약할 수 없어요.");
        LocalDateTime slot = when.withSecond(0).withNano(0);
        if (!slotTimes(lunch.get(0)).contains(slot.toLocalTime()) || when.getSecond() != 0) {
            throw ApiException.validation("reservationDate", "예약 가능한 시간(30분 단위)을 골라 주세요.");
        }

        // 잠금 읽기(FOR UPDATE)라 트랜잭션 스냅샷이 아닌 "지금 커밋된 최신 값"을 봐요 → 앞 사람이 막 넣은 예약도 보임
        Integer taken = jdbc.queryForObject("""
                SELECT COUNT(*) FROM hospital_reservations
                WHERE hospital_id = :hid AND reservation_date = :at AND status IN ('PENDING', 'CONFIRMED')
                FOR UPDATE
                """, new MapSqlParameterSource("hid", req.hospitalId()).addValue("at", slot), Integer.class);
        if (taken != null && taken > 0) {
            throw ApiException.conflict("TIME_SLOT_TAKEN", "이미 예약이 찬 시간이에요. 다른 시간을 골라 주세요.");
        }

        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO hospital_reservations (user_id, hospital_id, pet_id, reservation_date, status)
                VALUES (:me, :hid, :pid, :at, 'PENDING')
                """, new MapSqlParameterSource("me", me).addValue("hid", req.hospitalId()).addValue("pid", pet.petId()).addValue("at", slot),
                key, new String[]{"reservation_id"});
        return find(key.getKey().longValue(), me);
    }

    private static final String RESERVATION_SELECT = """
            SELECT hr.reservation_id, hr.user_id, hr.hospital_id, h.name AS hospital_name, h.user_id AS owner_id,
                   hr.pet_id, p.name AS pet_name, hr.reservation_date, hr.status, hr.created_at,
                   EXISTS (SELECT 1 FROM reviews rv WHERE rv.user_id = hr.user_id AND rv.target_type = 'HOSPITAL'
                                                       AND rv.target_id = hr.hospital_id) AS reviewed
            FROM hospital_reservations hr
            JOIN hospitals h ON h.hospital_id = hr.hospital_id
            LEFT JOIN pets p ON p.pet_id = hr.pet_id
            """;

    private static final RowMapper<Reservation> RESERVATION = (rs, i) -> new Reservation(
            rs.getLong("reservation_id"), "HOSPITAL", rs.getLong("hospital_id"), rs.getString("hospital_name"),
            Rs.longOrNull(rs, "pet_id"), rs.getString("pet_name"), Rs.isoDateTime(rs, "reservation_date"),
            rs.getString("status"), Rs.isoDateTime(rs, "created_at"), rs.getBoolean("reviewed"));

    /** 내 예약 (S08) — 최근 일시가 위로 */
    public List<Reservation> mine(long me) {
        return jdbc.query(RESERVATION_SELECT + " WHERE hr.user_id = :me ORDER BY hr.reservation_date DESC, hr.reservation_id DESC",
                new MapSqlParameterSource("me", me), RESERVATION);
    }

    private Reservation find(long reservationId, long me) {
        List<Reservation> rows = jdbc.query(RESERVATION_SELECT + " WHERE hr.reservation_id = :id",
                new MapSqlParameterSource("id", reservationId), RESERVATION);
        if (rows.isEmpty()) throw ApiException.notFound("RESERVATION_NOT_FOUND", "예약을 찾을 수 없어요.");
        return rows.get(0);
    }

    /** [예약자 user_id, 병원 사업자 user_id, 현재 상태] — 행을 잠가요 */
    private Object[] lockReservation(long reservationId) {
        List<Object[]> rows = jdbc.query("""
                SELECT hr.user_id, h.user_id AS owner_id, hr.status
                FROM hospital_reservations hr JOIN hospitals h ON h.hospital_id = hr.hospital_id
                WHERE hr.reservation_id = :id FOR UPDATE
                """, new MapSqlParameterSource("id", reservationId),
                (rs, i) -> new Object[]{Rs.longOrNull(rs, "user_id"), Rs.longOrNull(rs, "owner_id"), rs.getString("status")});
        if (rows.isEmpty()) throw ApiException.notFound("RESERVATION_NOT_FOUND", "예약을 찾을 수 없어요.");
        return rows.get(0);
    }

    /** PATCH /hospital-reservations/{id}/cancel — 본인, 승인대기·예약확정만 */
    @Transactional
    public Reservation cancel(long me, long reservationId) {
        Object[] row = lockReservation(reservationId);
        Long owner = (Long) row[0];
        if (owner == null || owner != me) throw ApiException.forbidden("내 예약만 취소할 수 있어요.");
        if (!ReservationPolicy.ACTIVE.contains((String) row[2])) {
            throw ApiException.conflict("RESERVATION_NOT_CANCELLABLE", "취소할 수 없는 예약이에요.");
        }
        updateStatus(reservationId, "CANCELLED");
        return find(reservationId, me);
    }

    /** PATCH /hospital-reservations/{id}/status — 병원(사업자)·관리자, 시연 모드면 본인도 */
    @Transactional
    public Reservation changeStatus(long me, long reservationId, String status) {
        Object[] row = lockReservation(reservationId);
        policy.checkCanChangeStatus(me, (Long) row[1], (Long) row[0]);
        policy.checkTransition((String) row[2], status);
        updateStatus(reservationId, status);
        return find(reservationId, me);
    }

    private void updateStatus(long reservationId, String status) {
        jdbc.update("UPDATE hospital_reservations SET status = :s WHERE reservation_id = :id",
                new MapSqlParameterSource("s", status).addValue("id", reservationId));
    }
}
