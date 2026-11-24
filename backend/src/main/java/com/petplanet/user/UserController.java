package com.petplanet.user;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.user.UserService.LoginRequest;
import com.petplanet.user.UserService.LoginResponse;
import com.petplanet.user.UserService.PublicUser;
import com.petplanet.user.UserService.SignupRequest;
import com.petplanet.user.UserService.SignupResponse;
import com.petplanet.user.UserService.Summary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** docs/04 §1 인증 · 회원 */
@RestController
@RequestMapping("/api")
public class UserController {

    public record ResetPasswordRequest(String email, String name) {
    }

    public record UpdateMeRequest(String name) {
    }

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping("/auth/check-email")
    public Map<String, Object> checkEmail(@RequestParam("email") String email) {
        return users.checkEmail(email);
    }

    @PostMapping("/auth/signup")
    public ResponseEntity<SignupResponse> signup(@RequestBody SignupRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(users.signup(body));
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@RequestBody LoginRequest body) {
        return users.login(body);
    }

    @GetMapping("/auth/me")
    public PublicUser me(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return users.find(Auth.require(userId));
    }

    @PostMapping("/auth/password/reset")
    public Map<String, Object> resetPassword(@RequestBody ResetPasswordRequest body) {
        return users.resetPassword(body == null ? null : body.email(), body == null ? null : body.name());
    }

    @PutMapping("/users/me")
    public PublicUser updateMe(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                               @RequestBody UpdateMeRequest body) {
        return users.updateMe(Auth.require(userId), body == null ? null : body.name());
    }

    @GetMapping("/users/me/summary")
    public Summary summary(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return users.summary(Auth.require(userId));
    }

    @DeleteMapping("/users/me")
    public ResponseEntity<Void> withdraw(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        users.withdraw(Auth.require(userId));
        return ResponseEntity.noContent().build();
    }
}
