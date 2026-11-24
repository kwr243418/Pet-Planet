package com.petplanet.common;

import java.util.ArrayList;
import java.util.List;

/** 입력값 검증을 모아서 한 번에 400 으로 돌려줘요. */
public final class Errors {

    private final List<FieldMessage> list = new ArrayList<>();

    public Errors add(String field, String message) {
        list.add(new FieldMessage(field, message));
        return this;
    }

    /** ok 가 false 면 에러 추가 */
    public Errors check(boolean ok, String field, String message) {
        if (!ok) add(field, message);
        return this;
    }

    public void addAll(String prefix, List<FieldMessage> others) {
        for (FieldMessage m : others) list.add(new FieldMessage(prefix + m.field(), m.message()));
    }

    public boolean isEmpty() {
        return list.isEmpty();
    }

    public List<FieldMessage> list() {
        return list;
    }

    public void throwIfAny() {
        if (!list.isEmpty()) throw ApiException.validation(list);
    }
}
