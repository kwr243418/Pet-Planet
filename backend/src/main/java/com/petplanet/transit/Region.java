package com.petplanet.transit;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 주소 → 지역(시/도 짧은 이름, 시/군/구). 지역별 탐색 필터에 써요.
 * "전라남도 목포시 영산로 ..." · "전남광주통합특별시 목포시 ..." → (전남광주, 목포시) · "서울 마포구 ..." → (서울, 마포구)
 * 2026-07-01 전남 · 광주가 전남광주통합특별시로 합쳐져서, 예전 주소(전라남도 · 광주광역시)와 새 주소를 같은 지역으로 묶어요.
 * 같은 규칙: db/patch_bus_transit.sql(UPDATE), db/loader --access, frontend/src/utils/region.js
 */
public final class Region {

    /** 화면에 보여 줄 시/도 순서 */
    public static final List<String> SIDO_ORDER = List.of(
            "서울", "부산", "대구", "인천", "대전", "울산", "세종",
            "경기", "강원", "충북", "충남", "전북", "전남광주", "경북", "경남", "제주");

    private static final Map<String, String> ALIAS = new LinkedHashMap<>();

    static {
        alias("서울", "서울특별시", "서울시", "서울");
        alias("부산", "부산광역시", "부산시", "부산");
        alias("대구", "대구광역시", "대구시", "대구");
        alias("인천", "인천광역시", "인천시", "인천");

        alias("대전", "대전광역시", "대전시", "대전");
        alias("울산", "울산광역시", "울산시", "울산");
        alias("세종", "세종특별자치시", "세종시", "세종");
        alias("경기", "경기도", "경기");
        alias("강원", "강원특별자치도", "강원도", "강원");
        alias("충북", "충청북도", "충북");
        alias("충남", "충청남도", "충남");
        alias("전북", "전북특별자치도", "전라북도", "전북");
        // 2026-07-01 통합 (약칭 광주특별시). 예전 이름도 같은 지역으로
        alias("전남광주", "전남광주통합특별시", "전남광주특별시", "광주특별시", "전남광주", "전라남도", "전남", "광주광역시", "광주");
        alias("경북", "경상북도", "경북");
        alias("경남", "경상남도", "경남");
        alias("제주", "제주특별자치도", "제주도", "제주");
    }

    private static void alias(String sido, String... names) {
        for (String n : names) ALIAS.put(n, sido);
    }

    public record Parsed(String sido, String sigungu) {
    }

    private Region() {
    }

    /** 모르는 주소면 (null, null) */
    public static Parsed parse(String address) {
        if (address == null) return new Parsed(null, null);
        String[] t = address.trim().split("\\s+");
        String sido = t.length > 0 ? ALIAS.get(t[0]) : null;
        if (sido == null) return new Parsed(null, null);
        if (sido.equals("세종")) return new Parsed(sido, "세종시");
        String second = t.length > 1 ? t[1] : "";
        boolean isSigungu = second.endsWith("시") || second.endsWith("군") || second.endsWith("구");
        return new Parsed(sido, isSigungu ? second : null);
    }

    /** "전라남도" · "전남" 처럼 들어와도 짧은 이름으로. 모르면 null */
    public static String normalizeSido(String s) {
        return s == null ? null : ALIAS.get(s.trim());
    }
}
