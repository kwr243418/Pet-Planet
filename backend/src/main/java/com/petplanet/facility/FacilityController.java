package com.petplanet.facility;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.facility.FacilityService.Facility;
import com.petplanet.facility.FacilityService.Kind;
import com.petplanet.facility.FacilityService.Recent;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 동물병원 · 펫호텔 찜 + 마이페이지 "내 병원 · 호텔" (docs/05 §4) */
@RestController
@RequestMapping("/api")
public class FacilityController {

    private final FacilityService facilities;

    public FacilityController(FacilityService facilities) {
        this.facilities = facilities;
    }

    @GetMapping("/hospitals/{hospitalId}/bookmark")
    public Map<String, Object> hospitalBookmark(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                                @PathVariable("hospitalId") long hospitalId) {
        return facilities.bookmarkState(Auth.require(userId), Kind.HOSPITAL, hospitalId);
    }

    @PostMapping("/hospitals/{hospitalId}/bookmark")
    public Map<String, Object> bookmarkHospital(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                                @PathVariable("hospitalId") long hospitalId) {
        return facilities.bookmark(Auth.require(userId), Kind.HOSPITAL, hospitalId);
    }

    @DeleteMapping("/hospitals/{hospitalId}/bookmark")
    public Map<String, Object> unbookmarkHospital(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                                  @PathVariable("hospitalId") long hospitalId) {
        return facilities.unbookmark(Auth.require(userId), Kind.HOSPITAL, hospitalId);
    }

    @GetMapping("/pet-hotels/{hotelId}/bookmark")
    public Map<String, Object> hotelBookmark(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                             @PathVariable("hotelId") long hotelId) {
        return facilities.bookmarkState(Auth.require(userId), Kind.HOTEL, hotelId);
    }

    @PostMapping("/pet-hotels/{hotelId}/bookmark")
    public Map<String, Object> bookmarkHotel(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                             @PathVariable("hotelId") long hotelId) {
        return facilities.bookmark(Auth.require(userId), Kind.HOTEL, hotelId);
    }

    @DeleteMapping("/pet-hotels/{hotelId}/bookmark")
    public Map<String, Object> unbookmarkHotel(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                               @PathVariable("hotelId") long hotelId) {
        return facilities.unbookmark(Auth.require(userId), Kind.HOTEL, hotelId);
    }

    @GetMapping("/users/me/facility-bookmarks")
    public List<Facility> myBookmarks(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return facilities.myBookmarks(Auth.require(userId));
    }

    @GetMapping("/users/me/recent-facilities")
    public List<Recent> recent(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                               @RequestParam(name = "limit", required = false) Integer limit) {
        return facilities.recent(Auth.require(userId), limit);
    }
}
