package com.petplanet.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 시드 SQL(db/seed_demo.sql)은 BCrypt 해시를 직접 만들 수 없어서 비밀번호를 '{plain}petplanet123!' 처럼 넣어요.
 * 서버가 켜질 때 이런 행을 찾아 BCrypt 로 바꿔 저장해요. (한 번 바뀌면 다음부터는 대상이 없어요)
 */
@Component
public class SeedPasswordUpgrader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedPasswordUpgrader.class);
    private static final String PREFIX = "{plain}";

    private final NamedParameterJdbcTemplate jdbc;
    private final BCryptPasswordEncoder encoder;

    public SeedPasswordUpgrader(NamedParameterJdbcTemplate jdbc, BCryptPasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        try {
            List<Object[]> rows = jdbc.query(
                    "SELECT user_id, password FROM users WHERE password LIKE '{plain}%'",
                    new MapSqlParameterSource(),
                    (rs, i) -> new Object[]{rs.getLong("user_id"), rs.getString("password")});
            for (Object[] row : rows) {
                String plain = ((String) row[1]).substring(PREFIX.length());
                jdbc.update("UPDATE users SET password = :pw WHERE user_id = :id",
                        new MapSqlParameterSource().addValue("pw", encoder.encode(plain)).addValue("id", row[0]));
            }
            if (!rows.isEmpty()) log.info("시드 계정 {}개의 비밀번호를 BCrypt 로 바꿨어요.", rows.size());
        } catch (Exception e) {
            // DB 가 아직 준비 안 됐어도 서버는 뜨게 둬요 (첫 API 호출 때 오류로 알 수 있음)
            log.warn("시드 비밀번호 변환을 건너뜀: {}", e.getMessage());
        }
    }
}
