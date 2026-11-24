package com.petplanet.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JWT (HS256) 발급·검증 — 외부 라이브러리 없이 JDK 의 HmacSHA256 으로 만들었어요.
 * payload: { "sub": "사용자ID", "role": "USER", "iat": 발급시각, "exp": 만료시각 } (초 단위)
 */
@Component
public class JwtProvider {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final String HEADER = B64.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
    private static final Pattern SUB = Pattern.compile("\"sub\"\\s*:\\s*\"(\\d+)\"");
    private static final Pattern EXP = Pattern.compile("\"exp\"\\s*:\\s*(\\d+)");

    private final byte[] secret;
    private final long expiresSeconds;

    public JwtProvider(@Value("${petplanet.jwt.secret}") String secret,
                       @Value("${petplanet.jwt.expires-hours:24}") long expiresHours) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("petplanet.jwt.secret 은 32자 이상이어야 해요.");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.expiresSeconds = expiresHours * 3600;
    }

    public String create(long userId, String role) {
        long now = System.currentTimeMillis() / 1000;
        String payloadJson = "{\"sub\":\"" + userId + "\",\"role\":\"" + role + "\",\"iat\":" + now + ",\"exp\":" + (now + expiresSeconds) + "}";
        String payload = B64.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        String unsigned = HEADER + "." + payload;
        return unsigned + "." + B64.encodeToString(sign(unsigned));
    }

    /** 서명·만료가 맞으면 사용자 ID, 아니면 비어 있음 */
    public Optional<Long> parseUserId(String token) {
        if (token == null) return Optional.empty();
        String[] parts = token.split("\\.");
        if (parts.length != 3) return Optional.empty();
        try {
            byte[] expected = sign(parts[0] + "." + parts[1]);
            byte[] actual = B64D.decode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) return Optional.empty();
            String json = new String(B64D.decode(parts[1]), StandardCharsets.UTF_8);
            Matcher exp = EXP.matcher(json);
            Matcher sub = SUB.matcher(json);
            if (!exp.find() || !sub.find()) return Optional.empty();
            if (Long.parseLong(exp.group(1)) < System.currentTimeMillis() / 1000) return Optional.empty();
            return Optional.of(Long.parseLong(sub.group(1)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private byte[] sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("JWT 서명 실패", e);
        }
    }
}
