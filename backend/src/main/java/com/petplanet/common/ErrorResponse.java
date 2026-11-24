package com.petplanet.common;

import java.util.List;

/** docs/03 공통 에러 응답 */
public record ErrorResponse(int status, String code, String message, List<FieldMessage> errors) {
}
