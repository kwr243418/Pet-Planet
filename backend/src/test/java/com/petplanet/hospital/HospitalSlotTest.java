package com.petplanet.hospital;

import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 진료 예약 시간 칸: 10:00~17:30, 30분 단위, 점심시간 제외 (합의 [12]) */
class HospitalSlotTest {

    @Test
    void 기본_점심시간_13시부터_14시는_빠진다() {
        List<LocalTime> slots = HospitalService.slotTimes(null);
        assertEquals(14, slots.size());
        assertEquals(LocalTime.of(10, 0), slots.get(0));
        assertEquals(LocalTime.of(17, 30), slots.get(slots.size() - 1));
        assertFalse(slots.contains(LocalTime.of(13, 0)));
        assertFalse(slots.contains(LocalTime.of(13, 30)));
        assertTrue(slots.contains(LocalTime.of(14, 0)));
    }

    @Test
    void 병원마다_점심시간이_다르면_그_시간이_빠진다() {
        List<LocalTime> slots = HospitalService.slotTimes("12:00~13:00");
        assertFalse(slots.contains(LocalTime.of(12, 30)));
        assertTrue(slots.contains(LocalTime.of(13, 0)));
    }
}
