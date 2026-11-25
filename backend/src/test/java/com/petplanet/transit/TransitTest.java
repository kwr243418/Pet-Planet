package com.petplanet.transit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 지역 파싱 · 대중교통 접근성 등급 · TAGO 응답 파싱 (docs/09) */
class TransitTest {

    @Test
    void 주소에서_시도와_시군구를_뽑는다() {
        assertEquals(new Region.Parsed("전남광주", "목포시"), Region.parse("전라남도 목포시 영산로 123"));
        assertEquals(new Region.Parsed("전남광주", "목포시"), Region.parse("전남광주통합특별시 목포시 영산로 123"));   // 2026-07-01 통합 후 주소
        assertEquals(new Region.Parsed("전남광주", "무안군"), Region.parse("전남 무안군 청계면 영산로 1666"));
        assertEquals(new Region.Parsed("전남광주", "광산구"), Region.parse("광주광역시 광산구 임방울대로 1"));
        assertEquals(new Region.Parsed("서울", "마포구"), Region.parse("서울 마포구 양화로 23길 12"));
        assertEquals(new Region.Parsed("서울", "마포구"), Region.parse("서울특별시 마포구 와우산로 000 (시연용)"));
        assertEquals(new Region.Parsed("경기", "수원시"), Region.parse("경기도 수원시 장안구 정조로 1"));
        assertEquals(new Region.Parsed("세종", "세종시"), Region.parse("세종특별자치시 한누리대로 2130"));
        assertEquals(new Region.Parsed("강원", "춘천시"), Region.parse("강원특별자치도 춘천시 중앙로 1"));
        assertEquals(new Region.Parsed(null, null), Region.parse("주소 없음"));
        assertEquals(new Region.Parsed(null, null), Region.parse(null));
    }

    @Test
    void 시도_이름은_짧은_이름으로_맞춘다() {
        assertEquals("전남광주", Region.normalizeSido("전라남도"));
        assertEquals("전남광주", Region.normalizeSido(" 전남 "));
        assertEquals("전남광주", Region.normalizeSido("광주특별시"));
        assertNull(Region.normalizeSido("목포"));
    }

    @Test
    void 정류장이_가깝고_노선이_많으면_A() {
        assertEquals("A", BusAccess.grade(150, 3, 7));
        assertEquals("B", BusAccess.grade(150, 3, 2));
        assertEquals("B", BusAccess.grade(350, 1, 6));
        assertEquals("C", BusAccess.grade(350, 1, 1));
        assertEquals("C", BusAccess.grade(700, 5, null));   // 노선 정보가 없으면 반경 500m 정류장 수로
        assertEquals("C", BusAccess.grade(499, 1, null));   // 노을공원 같은 곳 (걸어서 7분)
        assertEquals("C", BusAccess.grade(700, 1, null));   // 800m 안이면 최소 C
        assertEquals("D", BusAccess.grade(1500, 9, 20));    // 800m 넘으면 노선이 많아도 D
        assertEquals("D", BusAccess.grade(null, 0, null));
    }

    @Test
    void 도보_시간은_분당_75m에_우회_25퍼센트() {
        assertEquals(1, BusAccess.walkMinutes(30));
        assertEquals(4, BusAccess.walkMinutes(200));
        assertNull(BusAccess.walkMinutes(null));
    }

    @Test
    void 정류장_계산_전이면_null_정류장이_멀면_D() {
        BusAccess far = BusAccess.of(null, null, null, 0, null);
        assertEquals("D", far.grade());
        assertNull(far.walkMin());
        BusAccess near = BusAccess.of("MPB1", "목포역", 120, 6, 0);
        assertEquals("A", near.grade());
        assertEquals(2, near.walkMin());
    }

    @Test
    void 내_위치는_대한민국_범위만() {
        assertNull(Origin.resolve(null, null));
        assertEquals(34.79, Origin.resolve(34.79, 126.38).lat());
        assertThrows(RuntimeException.class, () -> Origin.resolve(34.79, null));
        assertThrows(RuntimeException.class, () -> Origin.resolve(0.0, 0.0));
    }

    @Test
    void TAGO_응답_item_이_배열_객체_빈문자열_모두_처리() throws Exception {
        ObjectMapper om = new ObjectMapper();
        String many = """
                {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"items":{"item":[
                  {"arrprevstationcnt":5,"arrtime":420,"nodeid":"X","nodenm":"목포역","routeid":"R2","routeno":"1-2","routetp":"일반버스","vehicletp":"일반차량"},
                  {"arrprevstationcnt":1,"arrtime":95,"nodeid":"X","nodenm":"목포역","routeid":"R1","routeno":1,"routetp":"일반버스","vehicletp":"저상버스"}
                ]},"numOfRows":40,"pageNo":1,"totalCount":2}}}""";
        List<TagoClient.Arrival> a = TagoClient.parse(om.readTree(many));
        assertEquals(2, a.size());
        assertEquals("1", a.get(0).routeNo());      // 빨리 오는 순 · 숫자 노선번호도 문자열로
        assertEquals(2, a.get(0).minutes());
        assertTrue(a.get(0).lowFloor());
        assertEquals(7, a.get(1).minutes());

        String one = """
                {"response":{"header":{"resultCode":"00"},"body":{"items":{"item":{"arrtime":60,"routeno":"200","vehicletp":"일반차량"}}}}}""";
        assertEquals(1, TagoClient.parse(om.readTree(one)).size());

        String none = """
                {"response":{"header":{"resultCode":"00"},"body":{"items":"","totalCount":0}}}""";
        assertEquals(0, TagoClient.parse(om.readTree(none)).size());

        String error = """
                {"response":{"header":{"resultCode":"30","resultMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR"}}}""";
        assertThrows(TagoClient.TagoException.class, () -> TagoClient.parse(om.readTree(error)));
    }
}
