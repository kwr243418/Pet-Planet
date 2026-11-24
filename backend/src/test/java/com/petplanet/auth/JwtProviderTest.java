package com.petplanet.auth;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** DB 없이 도는 단위 테스트 — ./gradlew test */
class JwtProviderTest {

    private static final String SECRET = "petplanet-local-dev-secret-please-change-0123456789";

    @Test
    void 발급한_토큰에서_사용자ID를_꺼낸다() {
        JwtProvider jwt = new JwtProvider(SECRET, 24);
        assertEquals(Optional.of(42L), jwt.parseUserId(jwt.create(42, "USER")));
    }

    @Test
    void 서명이_다르거나_망가진_토큰은_거부한다() {
        JwtProvider jwt = new JwtProvider(SECRET, 24);
        JwtProvider other = new JwtProvider("another-secret-another-secret-another-secret!!", 24);
        String token = jwt.create(1, "USER");
        assertTrue(other.parseUserId(token).isEmpty());
        assertTrue(jwt.parseUserId(token.substring(0, token.length() - 3) + "abc").isEmpty());
        assertTrue(jwt.parseUserId("not-a-token").isEmpty());
    }

    @Test
    void 만료된_토큰은_거부한다() {
        JwtProvider expired = new JwtProvider(SECRET, -1);
        assertTrue(new JwtProvider(SECRET, 24).parseUserId(expired.create(1, "USER")).isEmpty());
    }

    @Test
    void 비밀키가_짧으면_시작하지_않는다() {
        assertThrows(IllegalStateException.class, () -> new JwtProvider("short", 24));
    }
}
