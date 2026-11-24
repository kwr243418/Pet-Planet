package com.petplanet.hospital;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.common.PageResponse;
import com.petplanet.hospital.HospitalService.AvailableTimes;
import com.petplanet.hospital.HospitalService.Hospital;
import com.petplanet.hospital.HospitalService.ReserveRequest;
import com.petplanet.hospital.HospitalService.Reservation;
import com.petplanet.hospital.HospitalService.StatusRequest;
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

/** docs/05 §1 동물병원 (S04-0 · S04 · S08) */
@RestController
@RequestMapping("/api")
public class HospitalController {

    private final HospitalService hospitals;

    public HospitalController(HospitalService hospitals) {
        this.hospitals = hospitals;
    }

    @GetMapping("/hospitals")
    public PageResponse<Hospital> list(@RequestParam(name = "stationId", required = false) Long stationId,
                                       @RequestParam(name = "radiusKm", required = false) Double radiusKm,
                                       @RequestParam(name = "keyword", required = false) String keyword,
                                       @RequestParam(name = "partner", required = false) Boolean partner,
                                       @RequestParam(name = "page", required = false) Integer page,
                                       @RequestParam(name = "size", required = false) Integer size) {
        return hospitals.list(stationId, radiusKm, keyword, partner, page, size);
    }

    @GetMapping("/hospitals/{hospitalId}")
    public Hospital get(@PathVariable("hospitalId") long hospitalId) {
        return hospitals.get(hospitalId);
    }

    @GetMapping("/hospitals/{hospitalId}/available-times")
    public AvailableTimes availableTimes(@PathVariable("hospitalId") long hospitalId, @RequestParam("date") String date) {
        return hospitals.availableTimes(hospitalId, date);
    }

    @PostMapping("/hospital-reservations")
    public ResponseEntity<Reservation> reserve(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                               @RequestBody ReserveRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hospitals.reserve(Auth.require(userId), body));
    }

    @GetMapping("/users/me/hospital-reservations")
    public List<Reservation> mine(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return hospitals.mine(Auth.require(userId));
    }

    @PatchMapping("/hospital-reservations/{reservationId}/cancel")
    public Reservation cancel(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                              @PathVariable("reservationId") long reservationId) {
        return hospitals.cancel(Auth.require(userId), reservationId);
    }

    @PatchMapping("/hospital-reservations/{reservationId}/status")
    public Reservation changeStatus(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                    @PathVariable("reservationId") long reservationId, @RequestBody StatusRequest body) {
        return hospitals.changeStatus(Auth.require(userId), reservationId, body == null ? null : body.status());
    }
}
