package com.petplanet.transit;

import com.petplanet.transit.BusService.Arrivals;
import com.petplanet.transit.BusService.Route;
import com.petplanet.transit.BusService.Stop;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** docs/09 §API 버스 정류장 · 노선 · 실시간 도착 */
@RestController
@RequestMapping("/api")
public class BusController {

    private final BusService bus;

    public BusController(BusService bus) {
        this.bus = bus;
    }

    /** GET /api/bus-stops/nearby?lat=&lng=&radiusM=500&limit=5 */
    @GetMapping("/bus-stops/nearby")
    public List<Stop> nearby(@RequestParam(name = "lat", required = false) Double lat,
                             @RequestParam(name = "lng", required = false) Double lng,
                             @RequestParam(name = "radiusM", required = false) Integer radiusM,
                             @RequestParam(name = "limit", required = false) Integer limit) {
        return bus.nearby(lat, lng, radiusM, limit);
    }

    @GetMapping("/bus-stops/{stopId}/routes")
    public List<Route> routes(@PathVariable("stopId") String stopId) {
        return bus.routes(stopId);
    }

    @GetMapping("/bus-stops/{stopId}/arrivals")
    public Arrivals arrivals(@PathVariable("stopId") String stopId) {
        return bus.arrivals(stopId);
    }
}
