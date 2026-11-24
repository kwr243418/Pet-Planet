package com.petplanet.shop;

import com.petplanet.common.ApiException;
import com.petplanet.common.Errors;
import com.petplanet.common.Rs;
import com.petplanet.user.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** 주문 (orders, order_items) — docs/05 §5. 가상 결제 = 주문 생성 */
@Service
public class OrderService {

    private static final Pattern PHONE = Pattern.compile("^01[016789]-?\\d{3,4}-?\\d{4}$");
    /** 배송 단계: 결제완료 → 배송준비 → 배송중 → 배송완료 */
    private static final List<String> FLOW = List.of("ORDERED", "PREPARING", "SHIPPING", "DELIVERED");

    public record OrderRequest(String receiverName, String receiverPhone, String address) {
    }

    public record StatusRequest(String status) {
    }

    public record OrderItem(Long productId, String name, int quantity, int price, int lineTotal, boolean reviewed) {
    }

    public record Order(long orderId, String status, int totalAmount, int shippingFee, String receiverName, String receiverPhone,
                        String address, String createdAt, String firstItemName, int itemCount, List<OrderItem> items) {
    }

    private record Line(long productId, String name, int price, int stock, int quantity) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final UserService users;
    private final boolean demoMode;

    public OrderService(NamedParameterJdbcTemplate jdbc, UserService users, @Value("${petplanet.demo-mode:false}") boolean demoMode) {
        this.jdbc = jdbc;
        this.users = users;
        this.demoMode = demoMode;
    }

    /**
     * 주문 트랜잭션 (BE2 핵심) — 하나의 트랜잭션에서:
     * 1. 장바구니 상품의 재고를 SELECT … FOR UPDATE 로 잠그고 확인 (product_id 순서로 잠가 교착 상태 방지)
     * 2. 하나라도 재고 부족 → 예외 → 전체 롤백, 409 OUT_OF_STOCK (장바구니는 그대로)
     * 3. orders INSERT → order_items INSERT (구매 당시 가격 저장)
     * 4. products.stock_quantity 차감
     * 5. cart_items 비우기
     */
    @Transactional
    public Order create(long me, OrderRequest req) {
        String name = req == null || req.receiverName() == null ? "" : req.receiverName().trim();
        String phone = req == null || req.receiverPhone() == null ? "" : req.receiverPhone().trim();
        String address = req == null || req.address() == null ? "" : req.address().trim();
        Errors errors = new Errors();
        errors.check(name.length() >= 2 && name.length() <= 50, "receiverName", "받는 분 이름을 2자 이상 입력해 주세요.");
        errors.check(PHONE.matcher(phone).matches(), "receiverPhone", "연락처를 010-0000-0000 모양으로 입력해 주세요.");
        errors.check(!address.isEmpty() && address.length() <= 255, "address", "배송 주소를 입력해 주세요.");
        errors.throwIfAny();

        MapSqlParameterSource meParam = new MapSqlParameterSource("me", me);
        List<Line> lines = jdbc.query("""
                SELECT p.product_id, p.name, p.price, p.stock_quantity, ci.quantity
                FROM cart_items ci
                JOIN products p ON p.product_id = ci.product_id
                WHERE ci.user_id = :me
                ORDER BY p.product_id
                FOR UPDATE
                """, meParam, (rs, i) -> new Line(rs.getLong("product_id"), rs.getString("name"), rs.getInt("price"),
                rs.getInt("stock_quantity"), rs.getInt("quantity")));
        if (lines.isEmpty()) throw ApiException.badRequest("CART_EMPTY", "장바구니가 비어 있어요.");

        for (Line l : lines) {
            if (l.quantity() > l.stock()) {
                throw ApiException.conflict("OUT_OF_STOCK", "'" + l.name() + "' 재고가 부족해요 (남은 수량 " + Math.max(l.stock(), 0)
                        + "개). 주문이 전체 취소됐고 장바구니는 그대로예요.");
            }
        }

        int productAmount = lines.stream().mapToInt(l -> l.price() * l.quantity()).sum();
        int shipping = CartService.SHIPPING_FEE;
        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO orders (user_id, total_amount, receiver_name, receiver_phone, address, shipping_fee, status)
                VALUES (:me, :total, :name, :phone, :address, :shipping, 'ORDERED')
                """, new MapSqlParameterSource("me", me).addValue("total", productAmount + shipping).addValue("name", name)
                .addValue("phone", phone).addValue("address", address).addValue("shipping", shipping), key, new String[]{"order_id"});
        long orderId = key.getKey().longValue();

        for (Line l : lines) {
            jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (:oid, :pid, :q, :price)",
                    new MapSqlParameterSource("oid", orderId).addValue("pid", l.productId()).addValue("q", l.quantity()).addValue("price", l.price()));
            int changed = jdbc.update("UPDATE products SET stock_quantity = stock_quantity - :q WHERE product_id = :pid AND stock_quantity >= :q",
                    new MapSqlParameterSource("q", l.quantity()).addValue("pid", l.productId()));
            if (changed != 1) throw ApiException.conflict("OUT_OF_STOCK", "'" + l.name() + "' 재고가 부족해요. 주문이 전체 취소됐어요.");
        }
        jdbc.update("DELETE FROM cart_items WHERE user_id = :me", meParam);
        return get(me, orderId);
    }

    private static final String ORDER_SELECT = """
            SELECT o.order_id, o.user_id, o.status, o.total_amount, o.shipping_fee, o.receiver_name, o.receiver_phone, o.address, o.created_at
            FROM orders o
            """;

    /** 내 주문 목록 (S08) — 상품 목록은 한 번의 쿼리로 모아서 붙여요 */
    public List<Order> mine(long me) {
        List<Order> orders = jdbc.query(ORDER_SELECT + " WHERE o.user_id = :me ORDER BY o.created_at DESC, o.order_id DESC",
                new MapSqlParameterSource("me", me), (rs, i) -> head(rs));
        return withItems(orders, me);
    }

    public Order get(long me, long orderId) {
        List<Order> rows = jdbc.query(ORDER_SELECT + " WHERE o.order_id = :id", new MapSqlParameterSource("id", orderId), (rs, i) -> {
            if (rs.getLong("user_id") != me) throw ApiException.forbidden("내 주문만 볼 수 있어요.");
            return head(rs);
        });
        if (rows.isEmpty()) throw ApiException.notFound("ORDER_NOT_FOUND", "주문을 찾을 수 없어요.");
        return withItems(rows, me).get(0);
    }

    private static Order head(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Order(rs.getLong("order_id"), rs.getString("status"), rs.getInt("total_amount"), rs.getInt("shipping_fee"),
                rs.getString("receiver_name"), rs.getString("receiver_phone"), rs.getString("address"), Rs.isoDateTime(rs, "created_at"),
                null, 0, List.of());
    }

    private List<Order> withItems(List<Order> orders, long me) {
        if (orders.isEmpty()) return orders;
        Map<Long, List<OrderItem>> byOrder = new HashMap<>();
        jdbc.query("""
                SELECT oi.order_id, oi.product_id, COALESCE(p.name, '판매가 끝난 상품') AS name, oi.quantity, oi.price,
                       EXISTS (SELECT 1 FROM reviews rv WHERE rv.user_id = :me AND rv.target_type = 'PRODUCT'
                                                          AND rv.target_id = oi.product_id) AS reviewed
                FROM order_items oi
                LEFT JOIN products p ON p.product_id = oi.product_id
                WHERE oi.order_id IN (:ids)
                ORDER BY oi.order_id, oi.order_item_id
                """, new MapSqlParameterSource("me", me).addValue("ids", orders.stream().map(Order::orderId).toList()),
                (RowCallbackHandler) rs -> {
                    int q = rs.getInt("quantity");
                    int price = rs.getInt("price");
                    byOrder.computeIfAbsent(rs.getLong("order_id"), k -> new ArrayList<>()).add(
                            new OrderItem(Rs.longOrNull(rs, "product_id"), rs.getString("name"), q, price, q * price, rs.getBoolean("reviewed")));
                });
        List<Order> out = new ArrayList<>();
        for (Order o : orders) {
            List<OrderItem> items = byOrder.getOrDefault(o.orderId(), List.of());
            out.add(new Order(o.orderId(), o.status(), o.totalAmount(), o.shippingFee(), o.receiverName(), o.receiverPhone(), o.address(),
                    o.createdAt(), items.isEmpty() ? null : items.get(0).name(), items.size(), items));
        }
        return out;
    }

    /** [주문자, 상태] — 행을 잠가요 */
    private Object[] lock(long orderId) {
        List<Object[]> rows = jdbc.query("SELECT user_id, status FROM orders WHERE order_id = :id FOR UPDATE",
                new MapSqlParameterSource("id", orderId), (rs, i) -> new Object[]{rs.getLong("user_id"), rs.getString("status")});
        if (rows.isEmpty()) throw ApiException.notFound("ORDER_NOT_FOUND", "주문을 찾을 수 없어요.");
        return rows.get(0);
    }

    /** 주문 취소 — 배송 시작(SHIPPING) 전까지만. 재고를 되돌리고 CANCELLED (한 트랜잭션) */
    @Transactional
    public Order cancel(long me, long orderId) {
        Object[] row = lock(orderId);
        if ((Long) row[0] != me) throw ApiException.forbidden("내 주문만 취소할 수 있어요.");
        String status = (String) row[1];
        if (!"ORDERED".equals(status) && !"PREPARING".equals(status)) {
            throw ApiException.conflict("ORDER_NOT_CANCELLABLE", "배송이 시작된 주문은 취소할 수 없어요.");
        }
        jdbc.update("""
                UPDATE products p
                JOIN order_items oi ON oi.product_id = p.product_id
                SET p.stock_quantity = p.stock_quantity + oi.quantity
                WHERE oi.order_id = :id
                """, new MapSqlParameterSource("id", orderId));
        jdbc.update("UPDATE orders SET status = 'CANCELLED' WHERE order_id = :id", new MapSqlParameterSource("id", orderId));
        return get(me, orderId);
    }

    /** 배송 단계 진행 (시연용) — 관리자, 시연 모드면 주문한 본인도. 한 단계씩 앞으로만 */
    @Transactional
    public Order changeStatus(long me, long orderId, String status) {
        Object[] row = lock(orderId);
        boolean admin = "ADMIN".equals(users.role(me));
        if (!admin && !(demoMode && (Long) row[0] == me)) throw ApiException.forbidden("배송 단계는 관리자만 바꿀 수 있어요.");
        String from = (String) row[1];
        int fromIdx = FLOW.indexOf(from);
        int toIdx = status == null ? -1 : FLOW.indexOf(status);
        if (toIdx < 0) throw ApiException.validation("status", "상태는 PREPARING, SHIPPING, DELIVERED 중 하나예요.");
        if (fromIdx < 0 || toIdx != fromIdx + 1) {
            throw ApiException.conflict("INVALID_STATUS_CHANGE", "배송 단계는 한 단계씩만 올릴 수 있어요. (" + from + " → " + status + ")");
        }
        jdbc.update("UPDATE orders SET status = :s WHERE order_id = :id", new MapSqlParameterSource("s", status).addValue("id", orderId));
        return get(me, orderId);
    }
}
