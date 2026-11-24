package com.petplanet.common;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** ResultSet 에서 NULL 을 살려서 꺼내는 도우미 (DECIMAL → double, DATETIME → ISO 문자열) */
public final class Rs {

    private Rs() {
    }

    public static Long longOrNull(ResultSet rs, String col) throws SQLException {
        long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }

    public static Integer intOrNull(ResultSet rs, String col) throws SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    public static Double dbl(ResultSet rs, String col) throws SQLException {
        BigDecimal v = rs.getBigDecimal(col);
        return v == null ? null : v.doubleValue();
    }

    /** 소수 3자리로 반올림 (거리 km) */
    public static Double km(ResultSet rs, String col) throws SQLException {
        Double v = dbl(rs, col);
        return v == null ? null : Geo.round3(v);
    }

    public static double dblOrZero(ResultSet rs, String col) throws SQLException {
        Double v = dbl(rs, col);
        return v == null ? 0.0 : v;
    }

    public static LocalDateTime dateTime(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, LocalDateTime.class);
    }

    public static String isoDateTime(ResultSet rs, String col) throws SQLException {
        return Times.iso(dateTime(rs, col));
    }

    public static LocalDate date(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, LocalDate.class);
    }

    public static String isoDate(ResultSet rs, String col) throws SQLException {
        LocalDate d = date(rs, col);
        return d == null ? null : d.toString();
    }
}
