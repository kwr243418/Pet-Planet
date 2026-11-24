package com.petplanet.reservation;

import com.petplanet.common.ApiException;
import com.petplanet.user.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * 예약 상태 흐름: PENDING(승인대기) → CONFIRMED(예약확정) → COMPLETED(이용완료), PENDING·CONFIRMED → CANCELLED
 * 상태 변경 권한: 관리자(ADMIN), 그 병원·호텔의 사업자(BUSINESS), 시연 모드면 예약한 본인도.
 */
@Component
public class ReservationPolicy {

    public static final Set<String> ACTIVE = Set.of("PENDING", "CONFIRMED");
    private static final Map<String, Set<String>> NEXT = Map.of(
            "PENDING", Set.of("CONFIRMED", "CANCELLED"),
            "CONFIRMED", Set.of("COMPLETED", "CANCELLED"),
            "COMPLETED", Set.of(),
            "CANCELLED", Set.of());

    private final UserService users;
    private final boolean demoMode;

    public ReservationPolicy(UserService users, @Value("${petplanet.demo-mode:false}") boolean demoMode) {
        this.users = users;
        this.demoMode = demoMode;
    }

    public void checkTransition(String from, String to) {
        if (to == null || !NEXT.containsKey(to)) {
            throw ApiException.validation("status", "상태는 PENDING, CONFIRMED, COMPLETED, CANCELLED 중 하나예요.");
        }
        if (!NEXT.getOrDefault(from, Set.of()).contains(to)) {
            throw ApiException.conflict("INVALID_STATUS_CHANGE", "지금 상태에서는 바꿀 수 없어요. (" + from + " → " + to + ")");
        }
    }

    /** @param businessOwnerId 병원·호텔의 사업자 user_id (없으면 null) */
    public void checkCanChangeStatus(long me, Long businessOwnerId, Long reservationOwnerId) {
        String role = users.role(me);
        if ("ADMIN".equals(role)) return;
        if ("BUSINESS".equals(role) && businessOwnerId != null && businessOwnerId == me) return;
        if (demoMode && reservationOwnerId != null && reservationOwnerId == me) return;
        throw ApiException.forbidden("예약 상태는 병원·호텔 사업자나 관리자만 바꿀 수 있어요.");
    }

    public boolean demoMode() {
        return demoMode;
    }
}
