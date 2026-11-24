package com.petplanet.shop;

import com.petplanet.common.ApiException;
import com.petplanet.common.Rs;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** 장바구니 (cart_items) — docs/05 §4 */
@Service
public class CartService {

    /** 배송비: 장바구니에 상품이 있으면 3,000원 */
    public static final int SHIPPING_FEE = 3000;
    private static final int MAX_QUANTITY = 99;

    public record CartItem(long cartId, long productId, Long categoryId, String categoryName, String name, int price, int quantity,
                           int lineTotal, int stockQuantity, String imageUrl) {
    }

    public record Cart(List<CartItem> items, int itemCount, int productAmount, int shippingFee, int totalAmount) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CartService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Cart get(long me) {
        List<CartItem> items = jdbc.query("""
                SELECT ci.cart_id, ci.product_id, ci.quantity, p.name, p.price, p.stock_quantity, p.image_url,
                       p.category_id, c.name AS category_name
                FROM cart_items ci
                JOIN products p ON p.product_id = ci.product_id
                LEFT JOIN product_categories c ON c.category_id = p.category_id
                WHERE ci.user_id = :me
                ORDER BY ci.created_at, ci.cart_id
                """, new MapSqlParameterSource("me", me), (rs, i) -> {
            int price = rs.getInt("price");
            int qty = rs.getInt("quantity");
            return new CartItem(rs.getLong("cart_id"), rs.getLong("product_id"), Rs.longOrNull(rs, "category_id"),
                    rs.getString("category_name"), rs.getString("name"), price, qty, price * qty, rs.getInt("stock_quantity"),
                    rs.getString("image_url"));
        });
        int productAmount = items.stream().mapToInt(CartItem::lineTotal).sum();
        int shipping = items.isEmpty() ? 0 : SHIPPING_FEE;
        return new Cart(items, items.size(), productAmount, shipping, productAmount + shipping);
    }

    /**
     * 담기 — 같은 상품이면 수량을 합쳐요.
     * UNIQUE(user_id, product_id) + INSERT … ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
     */
    @Transactional
    public Cart add(long me, Long productId, Integer quantity) {
        if (productId == null) throw ApiException.validation("productId", "담을 상품을 골라 주세요.");
        int q = quantity == null ? 1 : quantity;
        if (q < 1 || q > MAX_QUANTITY) throw ApiException.validation("quantity", "수량은 1~" + MAX_QUANTITY + "개로 담아 주세요.");
        List<Map<String, Object>> product = jdbc.queryForList("""
                SELECT p.stock_quantity,
                       COALESCE((SELECT ci.quantity FROM cart_items ci WHERE ci.user_id = :me AND ci.product_id = p.product_id), 0) AS in_cart
                FROM products p WHERE p.product_id = :pid
                """, new MapSqlParameterSource("me", me).addValue("pid", productId));
        if (product.isEmpty()) throw ApiException.notFound("PRODUCT_NOT_FOUND", "존재하지 않는 상품이에요.");
        int stock = ((Number) product.get(0).get("stock_quantity")).intValue();
        int inCart = ((Number) product.get(0).get("in_cart")).intValue();
        if (stock <= 0) throw ApiException.conflict("OUT_OF_STOCK", "품절된 상품이에요.");
        if (inCart + q > stock) throw ApiException.conflict("OUT_OF_STOCK", "재고는 " + stock + "개까지 담을 수 있어요.");

        jdbc.update("""
                INSERT INTO cart_items (user_id, product_id, quantity) VALUES (:me, :pid, :q)
                ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
                """, new MapSqlParameterSource("me", me).addValue("pid", productId).addValue("q", q));
        return get(me);
    }

    /** 수량 변경 (1 이상, 재고 이하) */
    @Transactional
    public Cart update(long me, long cartId, Integer quantity) {
        Map<String, Object> row = own(me, cartId);
        int stock = ((Number) row.get("stock_quantity")).intValue();
        if (quantity == null || quantity < 1) throw ApiException.validation("quantity", "수량은 1개 이상이어야 해요.");
        if (quantity > stock) throw ApiException.conflict("OUT_OF_STOCK", "재고는 " + stock + "개까지예요.");
        jdbc.update("UPDATE cart_items SET quantity = :q WHERE cart_id = :id", new MapSqlParameterSource("q", quantity).addValue("id", cartId));
        return get(me);
    }

    public void remove(long me, long cartId) {
        own(me, cartId);
        jdbc.update("DELETE FROM cart_items WHERE cart_id = :id", new MapSqlParameterSource("id", cartId));
    }

    private Map<String, Object> own(long me, long cartId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT ci.user_id, p.stock_quantity FROM cart_items ci JOIN products p ON p.product_id = ci.product_id
                WHERE ci.cart_id = :id
                """, new MapSqlParameterSource("id", cartId));
        if (rows.isEmpty()) throw ApiException.notFound("CART_ITEM_NOT_FOUND", "장바구니에 없는 상품이에요.");
        if (((Number) rows.get(0).get("user_id")).longValue() != me) throw ApiException.forbidden("내 장바구니만 바꿀 수 있어요.");
        return rows.get(0);
    }
}
