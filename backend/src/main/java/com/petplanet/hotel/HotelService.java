package com.petplanet.hotel;

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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 펫 호텔 · 객실 · 객실 예약 (pet_hotels, room_types, hotel_reservations) — docs/05 §2 */
@Service
public class HotelService {

    private static final int MAX_NIGHTS = 30;

    public record Hotel(long hotelId, String name, String address, String phone, double lat, double lng, boolean partner,
                        long roomCount, Integer minPrice, String sido, String sigungu, BusAccess busAccess, Double distanceKm, List<Room> rooms) {
    }

    /** status: AVAILABLE(입실 가능) | OVERWEIGHT(체중 초과) | BOOKED(기간 겹침). 객실 정보만 볼 때는 null */
    public record Room(long roomId, long hotelId, String roomName, int pricePerNight, Double maxWeight, String status, Integer totalPrice) {
    }

    public record PetBrief(long petId, String name, Double weight) {
    }

    public record RoomAvailability(long hotelId, String checkIn, String checkOut, long nights, PetBrief pet, List<Room> rooms) {
    }

    public record ReserveRequest(Long roomId, Long petId, String checkInDate, String checkOutDate) {
    }

    public record Reservation(long reservationId, String kind, long hotelId, String hotelName, long roomId, String roomName,
                              Long petId, String petName, String checkInDate, String checkOutDate, long nights, int totalPrice,
                              String status, String createdAt) {
    }

    public record StatusRequest(String status) {
    }

    private static final String SELECT = """
            SELECT ht.hotel_id, ht.user_id, ht.name, ht.address, ht.phone, ht.latitude, ht.longitude,
                   (SELECT COUNT(*) FROM room_types rt WHERE rt.hotel_id = ht.hotel_id) AS room_count,
                   (SELECT MIN(rt.price_per_night) FROM room_types rt WHERE rt.hotel_id = ht.hotel_id) AS min_price,
            """ + BusAccess.columns("ht") + "\n";
    private static final String FROM = " FROM pet_hotels ht" + BusAccess.join("ht");

    private final NamedParameterJdbcTemplate jdbc;
    private final PetService pets;
    private final ReservationPolicy policy;

    public HotelService(NamedParameterJdbcTemplate jdbc, PetService pets, ReservationPolicy policy) {
        this.jdbc = jdbc;
        this.pets = pets;
        this.policy = policy;
    }

    private RowMapper<Hotel> mapper(boolean withDistance) {
        return (rs, i) -> {
            double lat = rs.getBigDecimal("latitude").doubleValue();
            double lng = rs.getBigDecimal("longitude").doubleValue();
            Double minPrice = Rs.dbl(rs, "min_price");
            return new Hotel(rs.getLong("hotel_id"), rs.getString("name"), rs.getString("address"), rs.getString("phone"), lat, lng,
                    Rs.longOrNull(rs, "user_id") != null, rs.getLong("room_count"), minPrice == null ? null : minPrice.intValue(),
                    rs.getString("sido"), rs.getString("sigungu"), BusAccess.from(rs), withDistance ? Rs.km(rs, "distance_km") : null, null);
        };
    }

    /** GET /pet-hotels — 내 위치 반경 또는 지역(sido · sigungu) · 정류장 300m(nearStop), bookable=true 면 객실이 등록된(예약 가능한) 호텔만 */
    public PageResponse<Hotel> list(Double lat, Double lng, Double radiusKm, String sido, String sigungu, Boolean nearStop,
                                    String keyword, Boolean bookable, Integer page, Integer size) {
        Paging paging = Paging.of(page, size, 10, 50);
        MapSqlParameterSource p = new MapSqlParameterSource();
        List<String> where = new ArrayList<>();
        Origin.Point origin = Origin.resolve(lat, lng);
        if (origin != null) {
            p.addValue("slat", origin.lat()).addValue("slng", origin.lng());
            if (radiusKm != null && radiusKm > 0) {
                where.add("ST_Distance_Sphere(POINT(ht.longitude, ht.latitude), POINT(:slng, :slat)) <= :radiusM");
                p.addValue("radiusM", Math.min(radiusKm, 20.0) * 1000);
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            where.add("(ht.name LIKE CONCAT('%', :kw, '%') OR ht.address LIKE CONCAT('%', :kw, '%'))");
            p.addValue("kw", keyword.trim());
        }
        BusAccess.filters("ht", sido, sigungu, nearStop, where, p);
        if (Boolean.TRUE.equals(bookable)) where.add("EXISTS (SELECT 1 FROM room_types rt2 WHERE rt2.hotel_id = ht.hotel_id)");
        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        String distance = origin != null ? ", ST_Distance_Sphere(POINT(ht.longitude, ht.latitude), POINT(:slng, :slat)) / 1000 AS distance_km\n" : "";
        // 객실이 등록된(예약 가능한) 호텔을 먼저
        String orderBy = origin != null ? "distance_km, ht.hotel_id"
                : "NOT EXISTS (SELECT 1 FROM room_types rt3 WHERE rt3.hotel_id = ht.hotel_id), (ht.nearest_stop_m IS NULL), ht.nearest_stop_m, ht.hotel_id";

        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM pet_hotels ht" + whereSql, p, Long.class);
        p.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Hotel> rows = jdbc.query(SELECT + distance + FROM + whereSql + " ORDER BY " + orderBy
                + " LIMIT :limit OFFSET :offset", p, mapper(origin != null));
        return PageResponse.of(rows, paging, total == null ? 0 : total);
    }

    /** GET /pet-hotels/{id} — 호텔 정보 + 객실 목록(상태 없이) */
    public Hotel get(long hotelId) {
        List<Hotel> rows = jdbc.query(SELECT + FROM + " WHERE ht.hotel_id = :id", new MapSqlParameterSource("id", hotelId), mapper(false));
        if (rows.isEmpty()) throw ApiException.notFound("HOTEL_NOT_FOUND", "존재하지 않는 펫 호텔이에요.");
        Hotel h = rows.get(0);
        return new Hotel(h.hotelId(), h.name(), h.address(), h.phone(), h.lat(), h.lng(), h.partner(), h.roomCount(), h.minPrice(),
                h.sido(), h.sigungu(), h.busAccess(), null, roomsOf(hotelId));
    }

    private static final RowMapper<Room> ROOM = (rs, i) -> new Room(rs.getLong("room_id"), rs.getLong("hotel_id"), rs.getString("room_name"),
            rs.getBigDecimal("price_per_night").intValue(), Rs.dbl(rs, "max_weight"), null, null);

    private List<Room> roomsOf(long hotelId) {
        return jdbc.query("SELECT room_id, hotel_id, room_name, price_per_night, max_weight FROM room_types WHERE hotel_id = :id ORDER BY max_weight, price_per_night, room_id",
                new MapSqlParameterSource("id", hotelId), ROOM);
    }

    private static LocalDate[] period(String checkIn, String checkOut, String inField, String outField) {
        LocalDate in = Times.parseDate(checkIn);
        LocalDate out = Times.parseDate(checkOut);
        Errors errors = new Errors();
        errors.check(in != null, inField, "체크인 날짜를 선택해 주세요.");
        errors.check(out != null, outField, "체크아웃 날짜를 선택해 주세요.");
        errors.throwIfAny();
        if (in.isBefore(Times.today())) throw ApiException.validation(inField, "지난 날짜는 예약할 수 없어요.");
        if (!out.isAfter(in)) throw ApiException.validation(outField, "체크아웃은 체크인 다음 날 이후여야 해요.");
        if (ChronoUnit.DAYS.between(in, out) > MAX_NIGHTS) throw ApiException.validation(outField, "최대 " + MAX_NIGHTS + "박까지 예약할 수 있어요.");
        return new LocalDate[]{in, out};
    }

    /**
     * GET /pet-hotels/{id}/rooms?petId=&checkIn=&checkOut= — 객실 + 상태 3종
     * 체중 초과(pets.weight > room_types.max_weight) → OVERWEIGHT, 기간 겹침 → BOOKED, 나머지 AVAILABLE(합계 금액 포함)
     */
    public RoomAvailability rooms(Long me, long hotelId, Long petId, String checkIn, String checkOut) {
        get(hotelId);
        LocalDate[] range = period(checkIn, checkOut, "checkIn", "checkOut");
        long nights = ChronoUnit.DAYS.between(range[0], range[1]);
        Pet pet = null;
        if (petId != null) pet = pets.get(com.petplanet.auth.Auth.require(me), petId);

        // 기간 겹침: 기존 체크인 < 새 체크아웃 AND 기존 체크아웃 > 새 체크인 (승인대기·예약확정 모두 막음 — 합의 [13])
        Set<Long> booked = new HashSet<>(jdbc.queryForList("""
                SELECT DISTINCT hr.room_id
                FROM hotel_reservations hr
                JOIN room_types rt ON rt.room_id = hr.room_id
                WHERE rt.hotel_id = :hid AND hr.status IN ('PENDING', 'CONFIRMED')
                  AND hr.check_in_date < :out AND hr.check_out_date > :in
                """, new MapSqlParameterSource("hid", hotelId).addValue("in", range[0]).addValue("out", range[1]), Long.class));

        List<Room> out = new ArrayList<>();
        for (Room r : roomsOf(hotelId)) {
            String status;
            if (pet != null && pet.weight() != null && r.maxWeight() != null && pet.weight() > r.maxWeight()) status = "OVERWEIGHT";
            else if (booked.contains(r.roomId())) status = "BOOKED";
            else status = "AVAILABLE";
            Integer total = "AVAILABLE".equals(status) ? (int) (r.pricePerNight() * nights) : null;
            out.add(new Room(r.roomId(), r.hotelId(), r.roomName(), r.pricePerNight(), r.maxWeight(), status, total));
        }
        PetBrief brief = pet == null ? null : new PetBrief(pet.petId(), pet.name(), pet.weight());
        return new RoomAvailability(hotelId, range[0].toString(), range[1].toString(), nights, brief, out);
    }

    /**
     * POST /hotel-reservations → PENDING
     * 객실 행을 SELECT … FOR UPDATE 로 잠근 뒤 체중·기간 겹침을 서버에서 다시 검사하고 INSERT (동시에 같은 객실 신청 방지)
     */
    @Transactional
    public Reservation reserve(long me, ReserveRequest req) {
        Errors errors = new Errors();
        errors.check(req != null && req.roomId() != null, "roomId", "객실을 선택해 주세요.");
        errors.check(req != null && req.petId() != null, "petId", "예약할 반려동물을 선택해 주세요.");
        errors.throwIfAny();
        LocalDate[] range = period(req.checkInDate(), req.checkOutDate(), "checkInDate", "checkOutDate");
        Pet pet = pets.get(me, req.petId());

        List<Room> rooms = jdbc.query("SELECT room_id, hotel_id, room_name, price_per_night, max_weight FROM room_types WHERE room_id = :id FOR UPDATE",
                new MapSqlParameterSource("id", req.roomId()), ROOM);
        if (rooms.isEmpty()) throw ApiException.notFound("ROOM_NOT_FOUND", "존재하지 않는 객실이에요.");
        Room room = rooms.get(0);

        if (room.maxWeight() != null && pet.weight() != null && pet.weight() > room.maxWeight()) {
            throw ApiException.conflict("ROOM_OVERWEIGHT", "반려동물 체중(" + pet.weight() + "kg)이 이 객실의 최대 수용 몸무게("
                    + room.maxWeight() + "kg)를 넘어요.");
        }
        Integer overlap = jdbc.queryForObject("""
                SELECT COUNT(*) FROM hotel_reservations
                WHERE room_id = :rid AND status IN ('PENDING', 'CONFIRMED')
                  AND check_in_date < :out AND check_out_date > :in
                FOR UPDATE
                """, new MapSqlParameterSource("rid", room.roomId()).addValue("in", range[0]).addValue("out", range[1]), Integer.class);
        if (overlap != null && overlap > 0) {
            throw ApiException.conflict("ROOM_ALREADY_BOOKED", "선택한 날짜에 이미 예약이 있어요. 다른 객실이나 날짜를 골라 주세요.");
        }

        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO hotel_reservations (user_id, room_id, pet_id, check_in_date, check_out_date, status)
                VALUES (:me, :rid, :pid, :in, :out, 'PENDING')
                """, new MapSqlParameterSource("me", me).addValue("rid", room.roomId()).addValue("pid", pet.petId())
                .addValue("in", range[0]).addValue("out", range[1]), key, new String[]{"reservation_id"});
        return find(key.getKey().longValue());
    }

    private static final String RESERVATION_SELECT = """
            SELECT hr.reservation_id, hr.user_id, rt.hotel_id, ht.name AS hotel_name, hr.room_id, rt.room_name, rt.price_per_night,
                   hr.pet_id, p.name AS pet_name, hr.check_in_date, hr.check_out_date, hr.status, hr.created_at,
                   DATEDIFF(hr.check_out_date, hr.check_in_date) AS nights
            FROM hotel_reservations hr
            JOIN room_types rt ON rt.room_id = hr.room_id
            JOIN pet_hotels ht ON ht.hotel_id = rt.hotel_id
            LEFT JOIN pets p ON p.pet_id = hr.pet_id
            """;

    private static final RowMapper<Reservation> RESERVATION = (rs, i) -> {
        long nights = rs.getLong("nights");
        int price = rs.getBigDecimal("price_per_night").intValue();
        return new Reservation(rs.getLong("reservation_id"), "HOTEL", rs.getLong("hotel_id"), rs.getString("hotel_name"),
                rs.getLong("room_id"), rs.getString("room_name"), Rs.longOrNull(rs, "pet_id"), rs.getString("pet_name"),
                Rs.isoDate(rs, "check_in_date"), Rs.isoDate(rs, "check_out_date"), nights, (int) (price * nights),
                rs.getString("status"), Rs.isoDateTime(rs, "created_at"));
    };

    public List<Reservation> mine(long me) {
        return jdbc.query(RESERVATION_SELECT + " WHERE hr.user_id = :me ORDER BY hr.check_in_date DESC, hr.reservation_id DESC",
                new MapSqlParameterSource("me", me), RESERVATION);
    }

    private Reservation find(long reservationId) {
        List<Reservation> rows = jdbc.query(RESERVATION_SELECT + " WHERE hr.reservation_id = :id", new MapSqlParameterSource("id", reservationId), RESERVATION);
        if (rows.isEmpty()) throw ApiException.notFound("RESERVATION_NOT_FOUND", "예약을 찾을 수 없어요.");
        return rows.get(0);
    }

    /** [예약자 user_id, 호텔 사업자 user_id, 현재 상태] — 행을 잠가요 */
    private Object[] lockReservation(long reservationId) {
        List<Object[]> rows = jdbc.query("""
                SELECT hr.user_id, ht.user_id AS owner_id, hr.status
                FROM hotel_reservations hr
                JOIN room_types rt ON rt.room_id = hr.room_id
                JOIN pet_hotels ht ON ht.hotel_id = rt.hotel_id
                WHERE hr.reservation_id = :id FOR UPDATE
                """, new MapSqlParameterSource("id", reservationId),
                (rs, i) -> new Object[]{Rs.longOrNull(rs, "user_id"), Rs.longOrNull(rs, "owner_id"), rs.getString("status")});
        if (rows.isEmpty()) throw ApiException.notFound("RESERVATION_NOT_FOUND", "예약을 찾을 수 없어요.");
        return rows.get(0);
    }

    @Transactional
    public Reservation cancel(long me, long reservationId) {
        Object[] row = lockReservation(reservationId);
        Long owner = (Long) row[0];
        if (owner == null || owner != me) throw ApiException.forbidden("내 예약만 취소할 수 있어요.");
        if (!ReservationPolicy.ACTIVE.contains((String) row[2])) {
            throw ApiException.conflict("RESERVATION_NOT_CANCELLABLE", "취소할 수 없는 예약이에요.");
        }
        updateStatus(reservationId, "CANCELLED");
        return find(reservationId);
    }

    @Transactional
    public Reservation changeStatus(long me, long reservationId, String status) {
        Object[] row = lockReservation(reservationId);
        policy.checkCanChangeStatus(me, (Long) row[1], (Long) row[0]);
        policy.checkTransition((String) row[2], status);
        updateStatus(reservationId, status);
        return find(reservationId);
    }

    private void updateStatus(long reservationId, String status) {
        jdbc.update("UPDATE hotel_reservations SET status = :s WHERE reservation_id = :id",
                new MapSqlParameterSource("s", status).addValue("id", reservationId));
    }
}
