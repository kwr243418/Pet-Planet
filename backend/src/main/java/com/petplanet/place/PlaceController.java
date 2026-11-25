package com.petplanet.place;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.common.PageResponse;
import com.petplanet.place.PlaceService.Place;
import com.petplanet.place.PlaceService.SearchQuery;
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

/** docs/04 §4 장소 · §5 찜 */
@RestController
@RequestMapping("/api")
public class PlaceController {

    private final PlaceService places;

    public PlaceController(PlaceService places) {
        this.places = places;
    }

    @GetMapping("/places")
    public PageResponse<Place> search(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                      @RequestParam(name = "stationId", required = false) Long stationId,
                                      @RequestParam(name = "lat", required = false) Double lat,
                                      @RequestParam(name = "lng", required = false) Double lng,
                                      @RequestParam(name = "radiusKm", required = false) Double radiusKm,
                                      @RequestParam(name = "categoryIds", required = false) String categoryIds,
                                      @RequestParam(name = "sizes", required = false) String sizes,
                                      @RequestParam(name = "indoor", required = false) String indoor,
                                      @RequestParam(name = "lines", required = false) String lines,
                                      @RequestParam(name = "keyword", required = false) String keyword,
                                      @RequestParam(name = "sort", required = false) String sort,
                                      @RequestParam(name = "page", required = false) Integer page,
                                      @RequestParam(name = "size", required = false) Integer size) {
        return places.search(new SearchQuery(stationId, lat, lng, radiusKm, categoryIds, sizes, indoor, lines, keyword, sort, page, size),
                Auth.orAnonymous(userId));
    }

    @GetMapping("/places/{placeId}")
    public Place detail(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                        @PathVariable("placeId") long placeId) {
        return places.detail(placeId, Auth.orAnonymous(userId));
    }

    @PostMapping("/places/{placeId}/bookmark")
    public Map<String, Object> bookmark(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                        @PathVariable("placeId") long placeId) {
        return places.bookmark(Auth.require(userId), placeId);
    }

    @DeleteMapping("/places/{placeId}/bookmark")
    public Map<String, Object> unbookmark(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                          @PathVariable("placeId") long placeId) {
        return places.unbookmark(Auth.require(userId), placeId);
    }

    @GetMapping("/users/me/bookmarks")
    public List<Place> myBookmarks(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return places.myBookmarks(Auth.require(userId));
    }
}
