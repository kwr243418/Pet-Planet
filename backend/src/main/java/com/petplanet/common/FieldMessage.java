package com.petplanet.common;

/** 입력값 검증 실패 1건 — field 는 요청 JSON 필드 이름 (배열이면 pets[0].weight) */
public record FieldMessage(String field, String message) {
}
