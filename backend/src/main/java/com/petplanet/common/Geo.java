package com.petplanet.common;

/** 하버사인 거리 (km) — DB 에서는 ST_Distance_Sphere 를 쓰고, 역 캐시처럼 자바에서 계산할 때 이걸 써요. */
public final class Geo {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private Geo() {
    }

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
    }

    public static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
