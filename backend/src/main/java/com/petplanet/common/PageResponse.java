package com.petplanet.common;

import java.util.List;

/** docs/03 목록 응답 { content, page, size, totalElements, totalPages, hasNext } */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages, boolean hasNext) {

    public static <T> PageResponse<T> of(List<T> content, Paging paging, long totalElements) {
        int totalPages = (int) ((totalElements + paging.size() - 1) / paging.size());
        boolean hasNext = (long) (paging.page() + 1) * paging.size() < totalElements;
        return new PageResponse<>(content, paging.page(), paging.size(), totalElements, totalPages, hasNext);
    }
}
