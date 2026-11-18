/* 멀티플레이 서버 주소 (Cloudflare Workers · 이름 mable22-mp)
 * Cloudflare가 이 저장소의 server/ 폴더를 직접 배포합니다(Workers Builds, main에 푸시하면 자동 재배포).
 * 비워 두면 빠른 매칭·친구와 하기가 잠기고 1인 플레이만 됩니다.
 * (시험할 때는 게임 주소 뒤에 ?mp=ws://localhost:8787 을 붙이면 이 값보다 우선합니다)
 */
window.MP_SERVER = window.MP_SERVER || 'wss://mable22-mp.handj957.workers.dev';
