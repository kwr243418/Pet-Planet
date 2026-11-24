package com.petplanet.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Authorization: Bearer {토큰} 을 읽어서 요청 속성 "userId" 에 넣어요.
 * 여기서는 막지 않고, 로그인이 필요한 API 가 Auth.require(userId) 로 401 을 던져요.
 * (비로그인도 되는 API — 장소 목록의 bookmarked 등 — 는 userId 가 null 이면 비로그인으로 처리)
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String USER_ID = "userId";

    private final JwtProvider jwt;

    public AuthInterceptor(JwtProvider jwt) {
        this.jwt = jwt;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwt.parseUserId(header.substring(7).trim()).ifPresent(id -> request.setAttribute(USER_ID, id));
        }
        return true;
    }
}
