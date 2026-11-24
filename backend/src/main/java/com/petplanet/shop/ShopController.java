package com.petplanet.shop;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.common.PageResponse;
import com.petplanet.shop.CartService.Cart;
import com.petplanet.shop.OrderService.Order;
import com.petplanet.shop.OrderService.OrderRequest;
import com.petplanet.shop.OrderService.StatusRequest;
import com.petplanet.shop.ProductService.Product;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** docs/05 §3 상품 · §4 장바구니 · §5 주문 (S06 · S07 · S08) */
@RestController
@RequestMapping("/api")
public class ShopController {

    public record CartAddRequest(Long productId, Integer quantity) {
    }

    public record CartUpdateRequest(Integer quantity) {
    }

    private final ProductService products;
    private final CartService cart;
    private final OrderService orders;

    public ShopController(ProductService products, CartService cart, OrderService orders) {
        this.products = products;
        this.cart = cart;
        this.orders = orders;
    }

    // ---------- 상품 ----------
    @GetMapping("/product-categories")
    public List<Map<String, Object>> categories() {
        return products.categories();
    }

    @GetMapping("/products")
    public PageResponse<Product> products(@RequestParam(name = "categoryId", required = false) Long categoryId,
                                          @RequestParam(name = "keyword", required = false) String keyword,
                                          @RequestParam(name = "sort", required = false) String sort,
                                          @RequestParam(name = "page", required = false) Integer page,
                                          @RequestParam(name = "size", required = false) Integer size) {
        return products.list(categoryId, keyword, sort, page, size);
    }

    @GetMapping("/products/{productId}")
    public Product product(@PathVariable("productId") long productId) {
        return products.get(productId);
    }

    // ---------- 장바구니 ----------
    @GetMapping("/cart")
    public Cart getCart(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return cart.get(Auth.require(userId));
    }

    @PostMapping("/cart/items")
    public Cart addItem(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                        @RequestBody CartAddRequest body) {
        return cart.add(Auth.require(userId), body == null ? null : body.productId(), body == null ? null : body.quantity());
    }

    @PatchMapping("/cart/items/{cartId}")
    public Cart updateItem(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                           @PathVariable("cartId") long cartId, @RequestBody CartUpdateRequest body) {
        return cart.update(Auth.require(userId), cartId, body == null ? null : body.quantity());
    }

    @DeleteMapping("/cart/items/{cartId}")
    public ResponseEntity<Void> removeItem(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                           @PathVariable("cartId") long cartId) {
        cart.remove(Auth.require(userId), cartId);
        return ResponseEntity.noContent().build();
    }

    // ---------- 주문 ----------
    @PostMapping("/orders")
    public ResponseEntity<Order> createOrder(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                             @RequestBody OrderRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orders.create(Auth.require(userId), body));
    }

    @GetMapping("/users/me/orders")
    public List<Order> myOrders(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return orders.mine(Auth.require(userId));
    }

    @GetMapping("/orders/{orderId}")
    public Order order(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                       @PathVariable("orderId") long orderId) {
        return orders.get(Auth.require(userId), orderId);
    }

    @PatchMapping("/orders/{orderId}/cancel")
    public Order cancel(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                        @PathVariable("orderId") long orderId) {
        return orders.cancel(Auth.require(userId), orderId);
    }

    @PatchMapping("/orders/{orderId}/status")
    public Order changeStatus(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                              @PathVariable("orderId") long orderId, @RequestBody StatusRequest body) {
        return orders.changeStatus(Auth.require(userId), orderId, body == null ? null : body.status());
    }
}
