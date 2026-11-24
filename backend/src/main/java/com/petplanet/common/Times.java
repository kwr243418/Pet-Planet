package com.petplanet.common;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/** 날짜 규칙 (docs/03): 날짜+시간 2026-11-20T14:00:00+09:00 / 날짜만 2026-11-20, 시간대 Asia/Seoul */
public final class Times {

    public static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private Times() {
    }

    public static String iso(LocalDateTime t) {
        return t == null ? null : t.atZone(SEOUL).format(ISO);
    }

    public static String iso(LocalDate d) {
        return d == null ? null : d.toString();
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(SEOUL);
    }

    public static LocalDate today() {
        return LocalDate.now(SEOUL);
    }

    /** "2026-11-20T14:00:00+09:00" 또는 "2026-11-20T14:00:00" / "2026-11-20T14:00" → 한국 시간 LocalDateTime. 형식이 틀리면 null */
    public static LocalDateTime parseDateTime(String s) {
        if (s == null || s.isBlank()) return null;
        String v = s.trim();
        try {
            return OffsetDateTime.parse(v).atZoneSameInstant(SEOUL).toLocalDateTime();
        } catch (DateTimeParseException ignore) {
            // 시간대가 없는 형식
        }
        try {
            return LocalDateTime.parse(v);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** "2026-11-20" → LocalDate. 형식이 틀리면 null */
    public static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
