package com.petplanet.station;

import com.petplanet.common.ApiException;
import com.petplanet.station.StationDirectory.Station;

/**
 * 주변 탐색의 기준점: 지하철역(stationId) 또는 내 위치(lat, lng).
 * 내 위치는 station_id 0 · 이름 "내 위치"인 가상의 역으로 돌려줘서, 거리 계산 SQL은 역일 때와 똑같이 씁니다.
 */
public final class Origin {

    /** 대한민국 범위 (제주 ~ 백령도 · 독도) — 범위 밖 좌표는 잘못 들어온 값으로 봐요 */
    private static final double MIN_LAT = 33.0, MAX_LAT = 39.0, MIN_LNG = 124.0, MAX_LNG = 132.0;

    private Origin() {
    }

    /** @return 기준점, 둘 다 없으면 null. 좌표가 우선이에요 */
    public static Station resolve(StationDirectory stations, Long stationId, Double lat, Double lng) {
        if (lat != null || lng != null) {
            if (lat == null || lng == null || lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
                throw ApiException.badRequest("INVALID_LOCATION", "위치 좌표가 올바르지 않아요.");
            }
            return new Station(0L, "내 위치", null, null, lat, lng);
        }
        if (stationId == null) return null;
        Station s = stations.find(stationId);
        if (s == null) throw ApiException.notFound("STATION_NOT_FOUND", "존재하지 않는 지하철역이에요.");
        return s;
    }
}
