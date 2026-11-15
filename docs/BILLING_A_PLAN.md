# MABLE22 결제 시스템 구현 기준 (A안)
## 범위
- Beginning Level 1 무료, Level 2~4 유료.
- Universe Level 1~4 유료.
- Beginning 2~4 전체 8,900원; Universe 1~4 전체 15,900원; 두 게임 전체 19,900원.
- 개별 가격 및 권한 매핑은 `billing/catalog.js`에 정의.
- 본 브랜치는 **상품 카탈로그 기초 단계**이며, 실제 결제·잠금·관리자·인증 기능은 미구현.

## 서버 설계
- 사용자 인증: 서버 세션 또는 검증된 토큰; 관리자 역할 별도.
- products: product_id, title, price_krw, active, version, updated_at.
- orders: order_id, user_id, product_id, amount_krw, currency, status, pg_payment_id, created_at.
- entitlements: user_id, game, level, source_order_id, status, granted_at, revoked_at.
- payment_events: provider_event_id UNIQUE, order_id, payload_hash, processed_at.
- admin_audit: actor_id, action, target_id, before_json, after_json, created_at.
- 서버가 가격을 조회하여 주문 생성; 클라이언트가 보낸 가격을 신뢰하지 않음.
- PG 서버 검증 및 웹훅 서명 확인, 이벤트 멱등 처리 후 권한 지급.
- 환불/취소 시 해당 주문이 부여한 권한을 회수하되 다른 유효 구매 권한은 유지.
- 전체 이용권과 개별 구매의 중복 권한을 합집합으로 계산.
- 운영 가격 수정은 관리자 인증 및 감사 로그 기록 후 반영. 기존 결제 금액 불변.
- 테스트 결제는 운영 권한과 완전히 분리된 환경에서만 허용.
- 개별 구매 후 번들 차액 할인은 추후 별도 규칙 및 테스트가 필요함.

## 보안 및 배포 선행 조건
현재 GitHub Pages의 level*.html, beginning-level*.html은 공개 정적 파일이므로 **직접 URL 접근을 막을 수 없음**. 클라이언트 잠금 UI만 추가해서 유료 출시하지 말 것. 실제 유료 콘텐츠는 인증된 서버/보호된 배포 영역으로 이전하거나, 서버가 검증된 권한으로 콘텐츠를 제공하는 아키텍처를 먼저 구현해야 함. 공개 정적 파일에 게임 로직이 남아 있으면 결제 없이 복제 가능함.
Cloudflare Workers 멀티플레이 서버의 ROOM 권한과 구매 권한은 별도 검증 필요. 관리자 API는 서버 측 권한 검사 필수.

## 검증 시나리오
1. Beginning 1은 비로그인 접근 가능.
2. 나머지 7개 레벨은 권한 없을 때 서버가 콘텐츠 접근 거부.
3. Beginning 번들은 Beginning 2~4만, Universe 번들은 Universe 1~4만 허용.
4. MABLE22 통합 번들은 양쪽 모든 레벨 허용.
5. 중복 구매 방지, 다중 기기 권한 복원, 환불 후 권한 회수.
6. 가격 조작, 웹훅 중복, 결제 실패, 관리자 권한 우회 거부.
7. PC/iPad/iPhone에서 기존 주사위·보드·저장·멀티플레이 회귀 테스트.

## 작업 단계
1. 상품 카탈로그 및 테스트.
2. 사용자 인증·서버 DB·관리자 상품/권한 API.
3. 보호된 콘텐츠 전달 및 게임 진입 게이트.
4. 모의 결제(테스트 전용)·구매 복원·환불 시뮬레이션.
5. PG 실연동 및 배포 검증.
