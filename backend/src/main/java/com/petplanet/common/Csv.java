package com.petplanet.common;

import java.util.ArrayList;
import java.util.List;

/** 여러 값 필터 ?categoryIds=1,2&sizes=SMALL,MEDIUM */
public final class Csv {

    private Csv() {
    }

    public static List<String> strings(String v) {
        List<String> out = new ArrayList<>();
        if (v == null || v.isBlank()) return out;
        for (String s : v.split(",")) {
            String t = s.trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    public static List<Long> longs(String v, String field) {
        List<Long> out = new ArrayList<>();
        for (String s : strings(v)) {
            try {
                out.add(Long.parseLong(s));
            } catch (NumberFormatException e) {
                throw ApiException.validation(field, "'" + field + "' 값의 형식이 올바르지 않아요.");
            }
        }
        return out;
    }
}
