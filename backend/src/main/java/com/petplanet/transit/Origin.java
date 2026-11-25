package com.petplanet.transit;

import com.petplanet.common.ApiException;

/**
 * 주변 탐색의 기준점 = 내 위치(lat, lng). 시연 위치(국립목포대학교 · 목포역)도 좌표로 들어와요.
 * 위치 좌표는 이번 검색의 거리 계산에만 쓰고 저장하거나 로그로 남기지 않아요 (docs/09 위치정보 항목).
 */
public final class Origin {

    /** 대한민국 범위 (제주 ~ 백령도 · 독도) — 범위 밖 좌표는 잘못 들어온 값으로 봐요 */
    private static final double MIN_LAT = 33.0, MAX_LAT = 39.0, MIN_LNG = 124.0, MAX_LNG = 132.0;

    public record Point(double lat, double lng) {
    }

    private Origin() {
    }

    /** @return 기준점, 둘 다 없으면 null */
    public static Point resolve(Double lat, Double lng) {
        if (lat == null && lng == null) return null;
        if (lat == null || lng == null || lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
            throw ApiException.badRequest("INVALID_LOCATION", "위치 좌표가 올바르지 않아요.");
        }
        return new Point(lat, lng);
    }
}
