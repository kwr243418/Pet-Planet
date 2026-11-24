package com.petplanet.common;

/** ?page=0&size=10 (page 는 0부터) */
public record Paging(int page, int size) {

    public static Paging of(Integer page, Integer size, int defaultSize, int maxSize) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null || size < 1 ? defaultSize : Math.min(size, maxSize);
        return new Paging(p, s);
    }

    public int offset() {
        return page * size;
    }
}
