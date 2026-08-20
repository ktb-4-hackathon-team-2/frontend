# API 명세서

ktb-hktn-team2 백엔드 API 명세.

- **Base URL (로컬)**: `http://localhost:8080`
- **요청/응답 형식**: `application/json; charset=UTF-8`
- **인증 방식**: JWT Access Token (`Authorization: Bearer <accessToken>`)
- **Spring Security 미사용** — 인증은 `AuthInterceptor` + `LoginMemberArgumentResolver` 로 직접 처리한다.

---

## 1. 전체 흐름

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant S as 서버
    participant DB as Member DB

    C->>S: POST /api/product-key/verify {key:"9999"}
    S-->>C: {valid: true}
    Note over C: valid=true 일 때만 회원가입/로그인 화면 진입

    C->>S: POST /api/signup {email, password}
    S->>DB: 비밀번호 해싱 후 저장
    S-->>C: 201 {id, email}

    C->>S: POST /api/login {email, password}
    S->>DB: 이메일 조회 + 비밀번호 대조
    S-->>C: 200 {accessToken, ...}
    Note over C: accessToken 을 저장

    C->>S: GET /api/me (Authorization: Bearer AT)
    S->>S: 토큰 서명/만료 검증 → memberId 추출
    S->>DB: findById(memberId)
    S-->>C: 200 {id, email}
```

1. **제품 키 확인** — `9999` 와 일치해야 회원가입/로그인 화면에 진입할 수 있다.
2. **회원가입 / 로그인** — 로그인 성공 시 response body 로 Access Token 을 받는다.
3. **그 외 모든 API** — `Authorization: Bearer <accessToken>` 헤더로 요청한다. 서버는 토큰에서 회원 PK 를 꺼내 회원 DB 를 조회한다.

---

## 2. 공통 에러 응답

에러는 상태 코드와 함께 아래 형식으로 내려온다.

```json
{
  "code": "LOGIN_FAILED",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다."
}
```

| code | HTTP | 설명 |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | 필수값 누락, 형식 오류, JSON 파싱 실패. `message` 에 어떤 필드가 왜 틀렸는지 담긴다 |
| `INVALID_PRODUCT_KEY` | 403 | 제품 키 불일치 (현재 verify API 는 예외 대신 `valid:false` 로 응답) |
| `DUPLICATE_EMAIL` | 409 | 이미 가입된 이메일 |
| `LOGIN_FAILED` | 401 | 이메일 또는 비밀번호 불일치 |
| `UNAUTHORIZED` | 401 | `Authorization` 헤더가 없거나 `Bearer ` 형식이 아님 |
| `INVALID_TOKEN` | 401 | 서명이 맞지 않거나 형식이 깨진 토큰 |
| `EXPIRED_TOKEN` | 401 | 만료된 토큰 → 재로그인 필요 |
| `MEMBER_NOT_FOUND` | 401 | 토큰은 유효하나 해당 회원이 DB 에 없음 (탈퇴 등) |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

> `INVALID_TOKEN` 과 `EXPIRED_TOKEN` 을 구분해서 내려주므로, 프론트에서 "만료 → 로그인 페이지로" 분기를 걸 수 있다.

---

## 3. API 목록

| Method | Path | 인증 | 설명 |
| --- | --- | :---: | --- |
| POST | `/api/product-key/verify` | ✕ | 제품 키 일치 여부 확인 |
| POST | `/api/signup` | ✕ | 회원가입 |
| POST | `/api/login` | ✕ | 로그인 (Access Token 발급) |
| GET | `/api/me` | ✓ | 내 정보 조회 |

---

## 4. 제품 키 확인

키가 맞는지만 판별한다. 서버에 저장하거나 토큰을 발급하지 않는다.

```
POST /api/product-key/verify
```

**Request**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | :---: | --- |
| `key` | string | ✓ | 제품 키 |

```json
{ "key": "9999" }
```

**Response `200 OK`**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `valid` | boolean | 키 일치 여부 |

```json
{ "valid": true }
```

키가 틀려도 200 이며 `valid` 만 `false` 로 내려온다.

```json
{ "valid": false }
```

**Error**

| 상황 | HTTP | code |
| --- | --- | --- |
| `key` 가 빈 값 | 400 | `INVALID_INPUT` |

**예시**

```bash
curl -X POST http://localhost:8080/api/product-key/verify \
  -H 'Content-Type: application/json' \
  -d '{"key":"9999"}'
```

> ⚠️ 이 API 는 **화면 진입용 게이트**다. 프론트에서 `valid=true` 일 때만 회원가입/로그인 화면을 열어주는 방식이며,
> 서버가 `/api/signup`·`/api/login` 호출 자체를 막지는 않는다. 서버에서도 강제하려면 아래 "9. 확장 포인트" 참고.

---

## 5. 회원가입

```
POST /api/signup
```

**Request**

| 필드 | 타입 | 필수 | 제약 |
| --- | --- | :---: | --- |
| `email` | string | ✓ | 이메일 형식, 100자 이하 |
| `password` | string | ✓ | 8자 이상 64자 이하 |

```json
{
  "email": "team2@ktb.com",
  "password": "password123"
}
```

**Response `201 Created`**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | number | 회원 PK |
| `email` | string | 이메일 |

```json
{
  "id": 1,
  "email": "team2@ktb.com"
}
```

비밀번호는 어떤 응답에도 포함되지 않는다.

**Error**

| 상황 | HTTP | code |
| --- | --- | --- |
| 이메일 형식 오류 / 비밀번호 길이 미달 | 400 | `INVALID_INPUT` |
| 이미 가입된 이메일 | 409 | `DUPLICATE_EMAIL` |

```json
{
  "code": "INVALID_INPUT",
  "message": "email: 이메일 형식이 올바르지 않습니다., password: 비밀번호는 8자 이상 64자 이하여야 합니다."
}
```

**예시**

```bash
curl -X POST http://localhost:8080/api/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"team2@ktb.com","password":"password123"}'
```

---

## 6. 로그인

로그인에 성공하면 **response body 로 Access Token** 을 전달한다. (쿠키/헤더 아님)

```
POST /api/login
```

**Request**

| 필드 | 타입 | 필수 |
| --- | --- | :---: |
| `email` | string | ✓ |
| `password` | string | ✓ |

```json
{
  "email": "team2@ktb.com",
  "password": "password123"
}
```

**Response `200 OK`**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `accessToken` | string | JWT. 이후 요청의 `Authorization` 헤더에 담아 보낸다 |
| `tokenType` | string | 항상 `"Bearer"` |
| `expiresIn` | number | 만료까지 남은 초 (기본 3600 = 1시간) |
| `member.id` | number | 회원 PK |
| `member.email` | string | 이메일 |

```json
{
  "accessToken": "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzg3MTE2NTk0LCJleHAiOjE3ODcxMjAxOTR9.7OLW5fS5PNEx-iRzh3GjDZ8ylM8D2AOxHvlCxlAT1cV",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "member": {
    "id": 1,
    "email": "team2@ktb.com"
  }
}
```

**Error**

| 상황 | HTTP | code |
| --- | --- | --- |
| 필수값 누락 | 400 | `INVALID_INPUT` |
| 이메일이 없거나 비밀번호가 틀림 | 401 | `LOGIN_FAILED` |

> 계정 존재 여부가 노출되지 않도록, 이메일이 없는 경우와 비밀번호가 틀린 경우 모두 동일하게 `LOGIN_FAILED` 로 응답한다.

**예시**

```bash
curl -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"team2@ktb.com","password":"password123"}'
```

---

## 7. 내 정보 조회 (인증 필요)

인증이 필요한 API 의 예시.

```
GET /api/me
```

**Request Header**

| 헤더 | 필수 | 값 |
| --- | :---: | --- |
| `Authorization` | ✓ | `Bearer <accessToken>` |

**Response `200 OK`**

```json
{
  "id": 1,
  "email": "team2@ktb.com"
}
```

**Error**

| 상황 | HTTP | code |
| --- | --- | --- |
| 헤더 없음 / `Bearer ` 접두어 없음 | 401 | `UNAUTHORIZED` |
| 서명 불일치, 깨진 토큰 | 401 | `INVALID_TOKEN` |
| 만료된 토큰 | 401 | `EXPIRED_TOKEN` |
| 토큰은 유효하나 회원이 DB 에 없음 | 401 | `MEMBER_NOT_FOUND` |

**예시**

```bash
curl http://localhost:8080/api/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzM4NCJ9..."
```

---

## 8. 인증이 필요한 API 추가하기 (팀원용)

`/api/**` 는 기본적으로 전부 인증이 걸린다. 컨트롤러 파라미터에 `@LoginMember Member member` 만 선언하면
토큰으로 조회된 회원이 그대로 주입된다.

```java
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @PostMapping("/posts")
    public ResponseEntity<PostResponse> create(@LoginMember Member member,
                                               @Valid @RequestBody PostCreateRequest request) {
        return ResponseEntity.ok(postService.create(member, request));
    }
}
```

토큰 없이 접근해야 하는 API 라면 `WebConfig.PUBLIC_PATHS` 에 경로를 추가한다.

```java
// src/main/java/com/example/ktb_hktn_team2/config/WebConfig.java
private static final String[] PUBLIC_PATHS = {
        "/api/product-key/**",
        "/api/signup",
        "/api/login"
};
```

에러를 내려주고 싶을 때는 `ApiException` 을 던지면 `GlobalExceptionHandler` 가 공통 포맷으로 변환한다.

```java
throw new ApiException(ErrorCode.MEMBER_NOT_FOUND);
```

---

## 9. 참고

### 구조

```
com.example.ktb_hktn_team2
├── auth        AuthController/Service, JwtProvider, AuthInterceptor, @LoginMember
├── member      Member 엔티티, MemberRepository, PasswordEncoder, MemberController
├── productkey  제품 키 확인
├── common      ApiException, ErrorCode, ErrorResponse, GlobalExceptionHandler
└── config      WebConfig (인터셉터/ArgumentResolver/CORS 등록)
```

### Member 테이블

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | BIGINT AUTO_INCREMENT | PK |
| `email` | VARCHAR(100) | UNIQUE (`uk_member_email`) |
| `pw` | VARCHAR(200) | PBKDF2 해시. `iterations$salt$hash` 형식 |

> API 요청 필드명은 `password`, DB 컬럼명은 `pw` 다.
> 비밀번호는 평문으로 저장되지 않는다 (PBKDF2-HMAC-SHA256, 100,000 iterations, 16-byte salt).
> Spring Security 를 쓰지 않으므로 JDK 표준 `SecretKeyFactory` 로 직접 구현했다. (`member/PasswordEncoder.java`)

### 설정값

`application.yaml` — 모두 환경변수로 덮어쓸 수 있다.

| 설정 | 환경변수 | 기본값 |
| --- | --- | --- |
| `app.product-key.value` | `PRODUCT_KEY` | `9999` |
| `app.jwt.secret` | `JWT_SECRET` | 로컬 개발용 문자열 (**운영에서는 반드시 교체**) |
| `app.jwt.access-token-expiration` | `JWT_EXPIRATION` | `1h` |
| `spring.datasource.url` | `DB_URL` | `jdbc:mysql://localhost:3306/ktb_hktn_team2` |
| `spring.datasource.username` | `DB_USERNAME` | `root` |
| `spring.datasource.password` | `DB_PASSWORD` | `root` |

JWT 서명 알고리즘은 시크릿 길이에 따라 자동 선택된다 (32바이트↑ HS256, 48바이트↑ HS384, 64바이트↑ HS512).
시크릿이 32바이트 미만이면 애플리케이션이 기동 시 실패한다.

### 실행

```bash
# MySQL 사용 (기본)
./gradlew bootRun

# MySQL 없이 H2 인메모리로 바로 띄우기
./gradlew bootRun --args='--spring.profiles.active=local'
```

### CORS

`/api/**` 에 대해 모든 Origin 을 허용해 둔 상태다 (`config/WebConfig.java`).
토큰을 쿠키가 아닌 `Authorization` 헤더로 주고받으므로 `allowCredentials` 는 사용하지 않는다.

---

## 10. 헬스체크 (Health Check)

배포 상태 검증 및 CI/CD 롤백 감지용 엔드포인트. 인증(토큰) 없이 접근 가능하다.

### GET `/health`, `/api/health`

**요청 헤더**: 없음

**응답 (200 OK)**:
```json
{
  "status": "ok",
  "service": "bandeut-backend"
}
```

---

## 11. 확장 포인트

**제품 키를 서버에서도 강제하고 싶다면** — 현재는 프론트 화면 게이트 용도라 `/api/signup`·`/api/login` 을 직접 호출하면 통과한다.
서버에서 막으려면 `SignupRequest`/`LoginRequest` 에 `productKey` 필드를 추가하고 서비스에서 검증하거나,
`X-Product-Key` 헤더를 검사하는 인터셉터를 두 경로에 걸면 된다.

**Refresh Token** — 현재는 Access Token 만 발급한다. 만료 시 재로그인이 필요하다.

