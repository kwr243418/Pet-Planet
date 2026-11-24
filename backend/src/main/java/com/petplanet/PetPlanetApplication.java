package com.petplanet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class PetPlanetApplication {

    public static void main(String[] args) {
        // 서버·DB 연결·JSON 날짜를 모두 한국 시간으로 (docs/03: 시간대 Asia/Seoul)
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
        SpringApplication.run(PetPlanetApplication.class, args);
    }
}
