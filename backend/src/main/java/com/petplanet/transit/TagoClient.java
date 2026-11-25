package com.petplanet.transit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 국토교통부(TAGO) 버스도착정보 — 정류소별 도착예정정보 목록 조회
 * https://www.data.go.kr/data/15098530/openapi.do
 *
 * 인증키는 환경변수 TAGO_SERVICE_KEY 또는 application-local.yml 의 petplanet.tago.service-key 에 넣어요 (커밋 금지).
 * 공공데이터포털의 "일반 인증키(Decoding)" 값을 그대로 넣으면 여기서 URL 인코딩해요.
 */
@Component
public class TagoClient {

    private static final String BASE = "https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList";

    public record Arrival(String routeId, String routeNo, String routeType, Integer minutes, Integer remainingStops, boolean lowFloor) {
    }

    /** 키가 없거나 호출이 실패했을 때 */
    public static class TagoException extends RuntimeException {
        public TagoException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private final String serviceKey;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

    public TagoClient(@Value("${petplanet.tago.service-key:}") String serviceKey, ObjectMapper json) {
        this.serviceKey = serviceKey == null ? "" : serviceKey.trim();
        this.json = json;
    }

    public boolean configured() {
        return !serviceKey.isEmpty();
    }

    public List<Arrival> arrivals(String cityCode, String nodeId) {
        String url = BASE + "?serviceKey=" + enc(serviceKey) + "&cityCode=" + enc(cityCode) + "&nodeId=" + enc(nodeId)
                + "&numOfRows=40&pageNo=1&_type=json";
        try {
            HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200) throw new TagoException("HTTP " + res.statusCode(), null);
            return parse(json.readTree(res.body()));
        } catch (TagoException e) {
            throw e;
        } catch (Exception e) {
            throw new TagoException(e.getClass().getSimpleName(), e);
        }
    }

    /** response.body.items.item 은 0건이면 "", 1건이면 객체, 여러 건이면 배열이에요 */
    static List<Arrival> parse(JsonNode root) {
        JsonNode header = root.path("response").path("header");
        String code = header.path("resultCode").asText("");
        if (!code.isEmpty() && !code.equals("00")) throw new TagoException("resultCode " + code + " " + header.path("resultMsg").asText(""), null);
        JsonNode item = root.path("response").path("body").path("items").path("item");
        List<Arrival> out = new ArrayList<>();
        if (item.isArray()) for (JsonNode n : item) out.add(toArrival(n));
        else if (item.isObject()) out.add(toArrival(item));
        out.sort((a, b) -> Integer.compare(a.minutes() == null ? 999 : a.minutes(), b.minutes() == null ? 999 : b.minutes()));
        return out;
    }

    private static Arrival toArrival(JsonNode n) {
        Integer seconds = n.hasNonNull("arrtime") ? n.get("arrtime").asInt() : null;
        Integer stops = n.hasNonNull("arrprevstationcnt") ? n.get("arrprevstationcnt").asInt() : null;
        return new Arrival(n.path("routeid").asText(null), n.path("routeno").asText(""), n.path("routetp").asText(null),
                seconds == null ? null : Math.max(0, (int) Math.ceil(seconds / 60.0)), stops,
                n.path("vehicletp").asText("").contains("저상"));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
