package com.petplanet.user;

import com.petplanet.auth.JwtProvider;
import com.petplanet.common.ApiException;
import com.petplanet.common.Errors;
import com.petplanet.common.FieldMessage;
import com.petplanet.common.Rs;
import com.petplanet.pet.PetService;
import com.petplanet.pet.PetService.Pet;
import com.petplanet.pet.PetService.PetInput;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** 인증 · 회원 (users) — docs/04 §1 */
@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PASSWORD = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?~`]).{8,20}$");
    private static final Pattern NAME = Pattern.compile("^[가-힣a-zA-Z\\s]{2,10}$");
    private static final Set<String> SIGNUP_ROLES = Set.of("USER", "BUSINESS");

    public record PublicUser(long userId, String email, String name, String role, String createdAt) {
    }

    public record SignupRequest(String email, String password, String name, String role, List<PetInput> pets) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record LoginResponse(String accessToken, PublicUser user) {
    }

    public record SignupResponse(String accessToken, PublicUser user, List<Pet> pets) {
    }

    public record Summary(long reservationCount, long orderCount, long reviewCount, long bookmarkCount) {
    }

    private static final RowMapper<PublicUser> USER = (rs, i) -> new PublicUser(
            rs.getLong("user_id"), rs.getString("email"), rs.getString("name"), rs.getString("role"), Rs.isoDateTime(rs, "created_at"));

    private final NamedParameterJdbcTemplate jdbc;
    private final BCryptPasswordEncoder encoder;
    private final JwtProvider jwt;
    private final PetService pets;
    private final boolean demoMode;
    private final SecureRandom random = new SecureRandom();

    public UserService(NamedParameterJdbcTemplate jdbc, BCryptPasswordEncoder encoder, JwtProvider jwt, PetService pets,
                       @Value("${petplanet.demo-mode:false}") boolean demoMode) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.jwt = jwt;
        this.pets = pets;
        this.demoMode = demoMode;
    }

    private static String normEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    public Map<String, Object> checkEmail(String email) {
        String e = normEmail(email);
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = :email", new MapSqlParameterSource("email", e), Integer.class);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("available", n == null || n == 0);
        return out;
    }

    /**
     * 계정 + 반려동물을 한 트랜잭션으로 (S09).
     * 반려동물 하나라도 검증에 실패하면 계정도 만들지 않아요. INSERT 중 오류가 나도 @Transactional 이 전부 롤백해요.
     */
    @Transactional
    public SignupResponse signup(SignupRequest req) {
        if (req == null) throw ApiException.validation("email", "가입 정보가 필요해요.");
        String email = normEmail(req.email());
        String name = req.name() == null ? "" : req.name().trim();
        Errors errors = new Errors();
        if (email.isEmpty()) errors.add("email", "이메일을 입력해 주세요.");
        else if (!EMAIL.matcher(email).matches() || email.length() > 100) errors.add("email", "이메일 형식이 올바르지 않아요.");
        if (req.password() == null || req.password().isEmpty()) errors.add("password", "비밀번호를 입력해 주세요.");
        else if (!PASSWORD.matcher(req.password()).matches()) errors.add("password", "영문, 숫자, 특수문자를 포함해 8~20자로 입력해 주세요.");
        if (name.isEmpty()) errors.add("name", "이름을 입력해 주세요.");
        else if (!NAME.matcher(name).matches()) errors.add("name", "이름은 한글 또는 영문 2~10자로 입력해 주세요.");
        if (req.role() == null || !SIGNUP_ROLES.contains(req.role())) errors.add("role", "회원 유형을 선택해 주세요.");
        List<PetInput> petInputs = req.pets() == null ? List.of() : req.pets();
        if (petInputs.isEmpty()) errors.add("pets", "반려동물을 한 마리 이상 등록해 주세요.");
        if (petInputs.size() > PetService.MAX_PETS) errors.add("pets", "반려동물은 최대 " + PetService.MAX_PETS + "마리까지 등록할 수 있어요.");
        for (int i = 0; i < petInputs.size(); i++) {
            List<FieldMessage> petErrors = PetService.validate(petInputs.get(i));
            errors.addAll("pets[" + i + "].", petErrors);
        }
        errors.throwIfAny();

        if (!(Boolean) checkEmail(email).get("available")) throw duplicateEmail();

        KeyHolder key = new GeneratedKeyHolder();
        try {
            jdbc.update("INSERT INTO users (email, password, name, role) VALUES (:email, :password, :name, :role)",
                    new MapSqlParameterSource()
                            .addValue("email", email)
                            .addValue("password", encoder.encode(req.password()))
                            .addValue("name", name)
                            .addValue("role", req.role()),
                    key, new String[]{"user_id"});
        } catch (DuplicateKeyException e) {
            throw duplicateEmail();
        }
        long userId = key.getKey().longValue();
        List<Pet> created = new ArrayList<>();
        for (PetInput in : petInputs) created.add(pets.insert(userId, in));
        PublicUser user = find(userId);
        return new SignupResponse(jwt.create(userId, user.role()), user, created);
    }

    private static ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일이에요.",
                List.of(new FieldMessage("email", "이미 가입된 이메일이에요.")));
    }

    public LoginResponse login(LoginRequest req) {
        String email = normEmail(req == null ? null : req.email());
        String password = req == null ? null : req.password();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT user_id, password FROM users WHERE email = :email",
                new MapSqlParameterSource("email", email));
        if (rows.isEmpty() || password == null || !matches(password, (String) rows.get(0).get("password"))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 일치하지 않아요.");
        }
        long userId = ((Number) rows.get(0).get("user_id")).longValue();
        PublicUser user = find(userId);
        return new LoginResponse(jwt.create(userId, user.role()), user);
    }

    private boolean matches(String raw, String hash) {
        if (hash == null || !hash.startsWith("$2")) return false; // BCrypt 가 아닌 옛 시드 값
        return encoder.matches(raw, hash);
    }

    public PublicUser find(long userId) {
        List<PublicUser> rows = jdbc.query("SELECT user_id, email, name, role, created_at FROM users WHERE user_id = :id",
                new MapSqlParameterSource("id", userId), USER);
        if (rows.isEmpty()) throw ApiException.unauthorized(); // 탈퇴 등으로 사라진 계정의 토큰
        return rows.get(0);
    }

    public String role(long userId) {
        return find(userId).role();
    }

    /**
     * 이메일 + 이름이 맞으면 임시 비밀번호로 바꿔요.
     * 메일 서버가 없어서 서버 로그에 남기고, 시연 모드면 응답에도 넣어요.
     */
    @Transactional
    public Map<String, Object> resetPassword(String email, String name) {
        String e = normEmail(email);
        String n = name == null ? "" : name.trim();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT user_id FROM users WHERE email = :email AND name = :name",
                new MapSqlParameterSource().addValue("email", e).addValue("name", n));
        if (rows.isEmpty()) throw ApiException.notFound("USER_NOT_FOUND", "입력하신 정보와 일치하는 회원이 없어요.");
        String temp = temporaryPassword();
        jdbc.update("UPDATE users SET password = :pw WHERE email = :email",
                new MapSqlParameterSource().addValue("pw", encoder.encode(temp)).addValue("email", e));
        log.info("[임시 비밀번호] {} → {}", e, temp);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sent", true);
        out.put("email", e);
        if (demoMode) out.put("temporaryPassword", temp);
        return out;
    }

    private String temporaryPassword() {
        String letters = "abcdefghjkmnpqrstuvwxyz";
        StringBuilder sb = new StringBuilder("pp");
        for (int i = 0; i < 4; i++) sb.append(letters.charAt(random.nextInt(letters.length())));
        for (int i = 0; i < 3; i++) sb.append(random.nextInt(10));
        return sb.append('!').toString();
    }

    public PublicUser updateMe(long userId, String name) {
        String n = name == null ? "" : name.trim();
        if (!NAME.matcher(n).matches()) throw ApiException.validation("name", "이름은 한글 또는 영문 2~10자로 입력해 주세요.");
        jdbc.update("UPDATE users SET name = :name WHERE user_id = :id", new MapSqlParameterSource().addValue("name", n).addValue("id", userId));
        return find(userId);
    }

    /** S08 활동 요약 — 예약·주문은 BE2 테이블 집계 */
    public Summary summary(long userId) {
        return jdbc.queryForObject("""
                SELECT
                  (SELECT COUNT(*) FROM hospital_reservations WHERE user_id = :me AND status IN ('PENDING','CONFIRMED'))
                + (SELECT COUNT(*) FROM hotel_reservations    WHERE user_id = :me AND status IN ('PENDING','CONFIRMED')) AS reservation_count,
                  (SELECT COUNT(*) FROM orders          WHERE user_id = :me) AS order_count,
                  (SELECT COUNT(*) FROM reviews         WHERE user_id = :me) AS review_count,
                  (SELECT COUNT(*) FROM place_bookmarks WHERE user_id = :me) AS bookmark_count
                """, new MapSqlParameterSource("me", userId), (rs, i) -> new Summary(
                rs.getLong("reservation_count"), rs.getLong("order_count"), rs.getLong("review_count"), rs.getLong("bookmark_count")));
    }

    /**
     * 회원 탈퇴. 진행 중 예약(승인대기·예약확정)이나 배송 전 주문(결제완료·배송준비)이 있으면 409.
     * users 를 지우면 FK 에 따라 pets·찜·리뷰·장바구니·주문은 CASCADE 삭제, 예약의 user_id 는 SET NULL.
     */
    @Transactional
    public void withdraw(long userId) {
        find(userId);
        Integer blocking = jdbc.queryForObject("""
                SELECT
                  (SELECT COUNT(*) FROM hospital_reservations WHERE user_id = :me AND status IN ('PENDING','CONFIRMED'))
                + (SELECT COUNT(*) FROM hotel_reservations    WHERE user_id = :me AND status IN ('PENDING','CONFIRMED'))
                + (SELECT COUNT(*) FROM orders                WHERE user_id = :me AND status IN ('ORDERED','PREPARING'))
                """, new MapSqlParameterSource("me", userId), Integer.class);
        if (blocking != null && blocking > 0) {
            throw ApiException.conflict("WITHDRAW_BLOCKED", "진행 중인 예약이나 배송 전 주문이 있어 탈퇴할 수 없어요.");
        }
        jdbc.update("DELETE FROM users WHERE user_id = :me", new MapSqlParameterSource("me", userId));
    }
}
