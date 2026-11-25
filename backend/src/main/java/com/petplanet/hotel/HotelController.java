package com.petplanet.hotel;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.common.PageResponse;
import com.petplanet.hotel.HotelService.Hotel;
import com.petplanet.hotel.HotelService.ReserveRequest;
import com.petplanet.hotel.HotelService.Reservation;
import com.petplanet.hotel.HotelService.RoomAvailability;
import com.petplanet.hotel.HotelService.StatusRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** docs/05 §2 펫 호텔 (S05 · S08) */
@RestController
@RequestMapping("/api")
public class HotelController {

    private final HotelService hotels;

    public HotelController(HotelService hotels) {
        this.hotels = hotels;
    }

    @GetMapping("/pet-hotels")
    public PageResponse<Hotel> list(@RequestParam(name = "stationId", required = false) Long stationId,
                                    @RequestParam(name = "lat", required = false) Double lat,
                                    @RequestParam(name = "lng", required = false) Double lng,
                                    @RequestParam(name = "radiusKm", required = false) Double radiusKm,
                                    @RequestParam(name = "keyword", required = false) String keyword,
                                    @RequestParam(name = "bookable", required = false) Boolean bookable,
                                    @RequestParam(name = "page", required = false) Integer page,
                                    @RequestParam(name = "size", required = false) Integer size) {
        return hotels.list(stationId, lat, lng, radiusKm, keyword, bookable, page, size);
    }

    @GetMapping("/pet-hotels/{hotelId}")
    public Hotel get(@PathVariable("hotelId") long hotelId) {
        return hotels.get(hotelId);
    }

    @GetMapping("/pet-hotels/{hotelId}/rooms")
    public RoomAvailability rooms(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                  @PathVariable("hotelId") long hotelId,
                                  @RequestParam(name = "petId", required = false) Long petId,
                                  @RequestParam(name = "checkIn") String checkIn,
                                  @RequestParam(name = "checkOut") String checkOut) {
        return hotels.rooms(userId, hotelId, petId, checkIn, checkOut);
    }

    @PostMapping("/hotel-reservations")
    public ResponseEntity<Reservation> reserve(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                               @RequestBody ReserveRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hotels.reserve(Auth.require(userId), body));
    }

    @GetMapping("/users/me/hotel-reservations")
    public List<Reservation> mine(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return hotels.mine(Auth.require(userId));
    }

    @PatchMapping("/hotel-reservations/{reservationId}/cancel")
    public Reservation cancel(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                              @PathVariable("reservationId") long reservationId) {
        return hotels.cancel(Auth.require(userId), reservationId);
    }

    @PatchMapping("/hotel-reservations/{reservationId}/status")
    public Reservation changeStatus(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                    @PathVariable("reservationId") long reservationId, @RequestBody StatusRequest body) {
        return hotels.changeStatus(Auth.require(userId), reservationId, body == null ? null : body.status());
    }
}
