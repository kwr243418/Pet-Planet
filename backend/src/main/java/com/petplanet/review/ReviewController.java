package com.petplanet.review;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.review.ReviewService.Eligibility;
import com.petplanet.review.ReviewService.Review;
import com.petplanet.review.ReviewService.ReviewInput;
import com.petplanet.review.ReviewService.ReviewPage;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** docs/04 §6 통합 리뷰 (+ docs/05 §6 상품·병원 리뷰 자격) */
@RestController
@RequestMapping("/api")
public class ReviewController {

    public record ReviewUpdate(Integer rating, String content) {
    }

    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/reviews")
    public ReviewPage list(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                           @RequestParam(name = "targetType", required = false) String targetType,
                           @RequestParam(name = "targetId") long targetId,
                           @RequestParam(name = "sort", required = false) String sort,
                           @RequestParam(name = "page", required = false) Integer page,
                           @RequestParam(name = "size", required = false) Integer size) {
        return reviews.list(targetType, targetId, sort, page, size, Auth.orAnonymous(userId));
    }

    @GetMapping("/reviews/eligibility")
    public Eligibility eligibility(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                   @RequestParam(name = "targetType") String targetType,
                                   @RequestParam(name = "targetId") long targetId) {
        return reviews.eligibility(userId, targetType, targetId);
    }

    @PostMapping("/reviews")
    public ResponseEntity<Review> create(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                         @RequestBody ReviewInput body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reviews.create(Auth.require(userId), body));
    }

    @PutMapping("/reviews/{reviewId}")
    public Review update(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                         @PathVariable("reviewId") long reviewId, @RequestBody ReviewUpdate body) {
        return reviews.update(Auth.require(userId), reviewId, body == null ? null : body.rating(), body == null ? null : body.content());
    }

    @DeleteMapping("/reviews/{reviewId}")
    public ResponseEntity<Void> delete(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                       @PathVariable("reviewId") long reviewId) {
        reviews.delete(Auth.require(userId), reviewId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/me/reviews")
    public List<Review> mine(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                             @RequestParam(name = "targetType", required = false) String targetType) {
        return reviews.mine(Auth.require(userId), targetType);
    }
}
