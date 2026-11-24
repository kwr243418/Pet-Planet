package com.petplanet.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

/** 모든 오류를 docs/03 의 { status, code, message, errors } 모양으로 바꿔요. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return body(e.getStatus(), e.getCode(), e.getMessage(), e.getErrors());
    }

    /** UNIQUE 제약 위반 중 서비스에서 미리 못 걸러낸 것 (동시에 두 번 누른 경우 등) */
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ErrorResponse> handleDuplicate(DuplicateKeyException e) {
        log.info("중복 키: {}", e.getMessage());
        return body(HttpStatus.CONFLICT, "DUPLICATE", "이미 등록된 정보예요.", List.of());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException e) {
        String msg = "'" + e.getParameterName() + "' 값이 필요해요.";
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", msg, List.of(new FieldMessage(e.getParameterName(), msg)));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        String msg = "'" + e.getName() + "' 값의 형식이 올바르지 않아요.";
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", msg, List.of(new FieldMessage(e.getName(), msg)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "요청 형식이 올바르지 않아요.", List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", "요청한 API가 없어요.", List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException e) {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식이에요.", List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknown(Exception e) {
        log.error("처리하지 못한 오류", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "잠시 후 다시 시도해 주세요.", List.of());
    }

    private ResponseEntity<ErrorResponse> body(HttpStatus status, String code, String message, List<FieldMessage> errors) {
        return ResponseEntity.status(status).body(new ErrorResponse(status.value(), code, message, errors));
    }
}
