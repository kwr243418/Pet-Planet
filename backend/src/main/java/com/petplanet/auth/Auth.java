package com.petplanet.auth;

import com.petplanet.common.ApiException;

/** 로그인이 필요한 API 에서 사용자 ID 를 꺼내요. 토큰이 없거나 만료면 401. */
public final class Auth {

    private Auth() {
    }

    public static long require(Long userId) {
        if (userId == null) throw ApiException.unauthorized();
        return userId;
    }

    /** 비로그인일 때 SQL 에 넣을 값 (어떤 사용자와도 안 맞는 -1) */
    public static long orAnonymous(Long userId) {
        return userId == null ? -1L : userId;
    }
}
