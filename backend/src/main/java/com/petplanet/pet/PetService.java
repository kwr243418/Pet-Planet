package com.petplanet.pet;

import com.petplanet.common.ApiException;
import com.petplanet.common.FieldMessage;
import com.petplanet.common.Rs;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** 반려동물 (pets) — docs/04 §2 */
@Service
public class PetService {

    public static final int MAX_PETS = 5;
    private static final Set<String> GENDERS = Set.of("MALE", "FEMALE");
    private static final int MAX_PHOTO_LENGTH = 500_000; // 240px 썸네일 data URL 이 보통 10~30KB

    /** 응답 { petId, userId, name, breed, weight, gender, neutered, photoUrl } */
    public record Pet(long petId, long userId, String name, String breed, Double weight, String gender, boolean neutered, String photoUrl) {
    }

    /** 요청 { name, breed, weight, gender, neutered, photoUrl } */
    public record PetInput(String name, String breed, Double weight, String gender, Boolean neutered, String photoUrl) {
    }

    static final RowMapper<Pet> MAPPER = (rs, i) -> new Pet(
            rs.getLong("pet_id"), rs.getLong("user_id"), rs.getString("name"), rs.getString("breed"),
            Rs.dbl(rs, "weight"), rs.getString("gender"), rs.getBoolean("is_neutered"), rs.getString("photo_url"));

    private static final String SELECT = """
            SELECT pet_id, user_id, name, breed, weight, gender, is_neutered, photo_url
            FROM pets
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public PetService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 필수: 이름·품종·체중·성별·중성화 (S09). 문제가 없으면 빈 목록 */
    public static List<FieldMessage> validate(PetInput in) {
        List<FieldMessage> errors = new ArrayList<>();
        if (in == null) {
            errors.add(new FieldMessage("name", "반려동물 정보가 필요해요."));
            return errors;
        }
        String name = trim(in.name());
        String breed = trim(in.breed());
        if (name.isEmpty()) errors.add(new FieldMessage("name", "아이 이름을 알려주세요."));
        else if (name.length() > 12) errors.add(new FieldMessage("name", "이름은 12자 이내로 입력해 주세요."));
        if (breed.isEmpty()) errors.add(new FieldMessage("breed", "품종을 입력해 주세요. (모르면 \"믹스\")"));
        else if (breed.length() > 20) errors.add(new FieldMessage("breed", "품종은 20자 이내로 입력해 주세요."));
        Double w = in.weight();
        if (w == null || w <= 0 || w > 100) errors.add(new FieldMessage("weight", "0.1kg ~ 100kg 사이로 입력해 주세요."));
        else if (BigDecimal.valueOf(w).stripTrailingZeros().scale() > 1) errors.add(new FieldMessage("weight", "소수점은 한 자리까지만 입력해 주세요."));
        if (in.gender() == null || !GENDERS.contains(in.gender())) errors.add(new FieldMessage("gender", "성별을 선택해 주세요."));
        if (in.neutered() == null) errors.add(new FieldMessage("neutered", "중성화 여부를 선택해 주세요."));
        if (in.photoUrl() != null && in.photoUrl().length() > MAX_PHOTO_LENGTH) errors.add(new FieldMessage("photoUrl", "사진 용량이 너무 커요."));
        return errors;
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    /** 이미 검증된 입력을 INSERT (회원가입 트랜잭션에서도 씀) */
    public Pet insert(long userId, PetInput in) {
        MapSqlParameterSource p = params(in).addValue("userId", userId);
        KeyHolder key = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO pets (user_id, name, breed, weight, gender, is_neutered, photo_url)
                VALUES (:userId, :name, :breed, :weight, :gender, :neutered, :photoUrl)
                """, p, key, new String[]{"pet_id"});
        return get(userId, key.getKey().longValue());
    }

    private static MapSqlParameterSource params(PetInput in) {
        return new MapSqlParameterSource()
                .addValue("name", in.name().trim())
                .addValue("breed", in.breed().trim())
                .addValue("weight", BigDecimal.valueOf(in.weight()))
                .addValue("gender", in.gender())
                .addValue("neutered", in.neutered())
                .addValue("photoUrl", in.photoUrl());
    }

    /** 첫 번째(가장 먼저 등록한) 반려동물 = 대표 */
    public List<Pet> list(long userId) {
        return jdbc.query(SELECT + " WHERE user_id = :userId ORDER BY pet_id", new MapSqlParameterSource("userId", userId), MAPPER);
    }

    /** 내 반려동물 한 마리 (없으면 404, 남의 것이면 403) */
    public Pet get(long userId, long petId) {
        List<Pet> rows = jdbc.query(SELECT + " WHERE pet_id = :petId", new MapSqlParameterSource("petId", petId), MAPPER);
        if (rows.isEmpty()) throw ApiException.notFound("PET_NOT_FOUND", "반려동물 정보를 찾을 수 없어요.");
        Pet pet = rows.get(0);
        if (pet.userId() != userId) throw ApiException.forbidden("내 반려동물만 선택하거나 수정할 수 있어요.");
        return pet;
    }

    public Pet create(long userId, PetInput in) {
        List<FieldMessage> errors = validate(in);
        if (!errors.isEmpty()) throw ApiException.validation(errors);
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM pets WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId), Integer.class);
        if (count != null && count >= MAX_PETS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PET_LIMIT", "반려동물은 최대 " + MAX_PETS + "마리까지 등록할 수 있어요.");
        }
        return insert(userId, in);
    }

    public Pet update(long userId, long petId, PetInput in) {
        get(userId, petId);
        List<FieldMessage> errors = validate(in);
        if (!errors.isEmpty()) throw ApiException.validation(errors);
        jdbc.update("""
                UPDATE pets SET name = :name, breed = :breed, weight = :weight, gender = :gender,
                                is_neutered = :neutered, photo_url = :photoUrl
                WHERE pet_id = :petId
                """, params(in).addValue("petId", petId));
        return get(userId, petId);
    }

    /** 예약·리뷰의 pet_id 는 FK ON DELETE SET NULL 이라 기록은 남아요 */
    public void delete(long userId, long petId) {
        get(userId, petId);
        jdbc.update("DELETE FROM pets WHERE pet_id = :petId", new MapSqlParameterSource("petId", petId));
    }
}
