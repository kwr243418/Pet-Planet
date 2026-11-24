package com.petplanet.shop;

import com.petplanet.common.ApiException;
import com.petplanet.common.PageResponse;
import com.petplanet.common.Paging;
import com.petplanet.common.Rs;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** 상품 · 상품 카테고리 (products, product_categories) — docs/05 §3 */
@Service
public class ProductService {

    public record Product(long productId, Long categoryId, String categoryName, String name, int price, int stockQuantity,
                          boolean soldOut, String imageUrl, double avgRating, long reviewCount, String description) {
    }

    private static final String SELECT = """
            SELECT p.product_id, p.category_id, c.name AS category_name, p.name, p.price, p.stock_quantity, p.image_url,
                   p.description, COALESCE(r.avg_rating, 0) AS avg_rating, COALESCE(r.review_count, 0) AS review_count
            FROM products p
            LEFT JOIN product_categories c ON c.category_id = p.category_id
            LEFT JOIN (SELECT target_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
                       FROM reviews WHERE target_type = 'PRODUCT' GROUP BY target_id) r ON r.target_id = p.product_id
            """;

    private static RowMapper<Product> mapper(boolean detail) {
        return (rs, i) -> {
            int stock = rs.getInt("stock_quantity");
            return new Product(rs.getLong("product_id"), Rs.longOrNull(rs, "category_id"), rs.getString("category_name"),
                    rs.getString("name"), rs.getInt("price"), stock, stock <= 0, rs.getString("image_url"),
                    Rs.dblOrZero(rs, "avg_rating"), rs.getLong("review_count"), detail ? rs.getString("description") : null);
        };
    }

    private final NamedParameterJdbcTemplate jdbc;

    public ProductService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 전체 · 사료 · 간식 · 위생용품 · 용품 */
    public List<Map<String, Object>> categories() {
        return jdbc.query("SELECT category_id, name FROM product_categories ORDER BY category_id", new MapSqlParameterSource(),
                (rs, i) -> Map.<String, Object>of("categoryId", rs.getLong("category_id"), "name", rs.getString("name")));
    }

    /** GET /products?categoryId=&keyword=&sort=&page=&size= — sort: latest(기본) | price_asc | price_desc | rating */
    public PageResponse<Product> list(Long categoryId, String keyword, String sort, Integer page, Integer size) {
        Paging paging = Paging.of(page, size, 20, 50);
        MapSqlParameterSource p = new MapSqlParameterSource();
        List<String> where = new ArrayList<>();
        if (categoryId != null) {
            where.add("p.category_id = :cid");
            p.addValue("cid", categoryId);
        }
        if (keyword != null && !keyword.isBlank()) {
            where.add("p.name LIKE CONCAT('%', :kw, '%')");
            p.addValue("kw", keyword.trim());
        }
        String whereSql = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        String orderBy = switch (sort == null ? "" : sort) {
            case "price_asc" -> "p.price, p.product_id";
            case "price_desc" -> "p.price DESC, p.product_id";
            case "rating" -> "avg_rating DESC, review_count DESC, p.product_id";
            default -> "p.product_id";
        };
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM products p" + whereSql, p, Long.class);
        p.addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<Product> rows = jdbc.query(SELECT + whereSql + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset", p, mapper(false));
        return PageResponse.of(rows, paging, total == null ? 0 : total);
    }

    public Product get(long productId) {
        List<Product> rows = jdbc.query(SELECT + " WHERE p.product_id = :id", new MapSqlParameterSource("id", productId), mapper(true));
        if (rows.isEmpty()) throw ApiException.notFound("PRODUCT_NOT_FOUND", "존재하지 않는 상품이에요.");
        return rows.get(0);
    }
}
