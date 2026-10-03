// 메모 필터 단위 테스트. 예시는 모두 지어낸 값이다(실제 계정·번호 아님).
import { describe, it, expect } from 'vitest';
import { scanMemo } from '../src/filter/memoFilter';

const secret = (t: string) => scanMemo(t);

describe('자격증명·개인정보(secret)', () => {
  const cases: [string, string][] = [
    ['password', '와이파이 비번 cafe2024!!'],
    ['password', '회사 메일 비밀번호: Qwer1234'],
    ['password', 'pw=hunter2024'],
    ['password', '넷플릭스 id test@example.com pw 7788abcd'],
    ['password', '현관 비번은 4812'],
    ['password', '공유기 암호 → 9090-1212'],
    ['card', '법인카드 4111 1111 1111 1111 유효기간 12/28'],
    ['card', '카드번호 5555-5555-5555-4444'],
    ['account', '월세 입금 국민 123456-12-123456'],
    ['account', '신한 110-123-456789 홍길동'],
    ['account', '토스로 보내줘 1000123456789'],
    ['rrn', '주민번호 900101-1234567 서류 제출'],
    ['phone', '치과 예약 02-123-4567 화요일'],
    ['phone', '엄마 번호 010 1234 5678'],
    ['phone', '대표번호 1588-1234'],
    ['email', '견적서는 someone@example.co.kr 로'],
    ['apikey', 'openai sk-proj-AbCdEfGhIjKlMnOpQrStUvWx123456'],
    ['apikey', 'aws AKIAABCDEFGHIJKLMNOP'],
    ['apikey', 'ghp_1234567890abcdefghijklmnopqrstuvwxyzAB'],
    ['apikey', 'xoxb-12345678-abcdefghijkl'],
    ['private_key', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE='],
    ['jwt', '토큰 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
    ['url_token', 'https://example.com/reset?token=ab12cd34ef56gh78'],
    ['random_string', '복구 코드 Xk9#mP2$vL7q'],
  ];
  for (const [kind, text] of cases) {
    it(`${kind}: ${text.slice(0, 24)}`, () => {
      const f = secret(text);
      expect(f.secret).toBe(true);
      expect(f.secretKinds).toContain(kind);
    });
  }
});

describe('평범한 메모는 통과', () => {
  const ok = [
    '비 오는 날 지하철 창에 맺힌 물방울이 위로 올라가는 것처럼 보였다',
    '비밀번호 바꿔야 함',
    '회의 메모. 결정 안 된 것만 적어두기로 함',
    '2025-10-03 오후 세 시 치과',
    '달리기 이십 분. 처음 오 분이 항상 제일 길다',
    '제목 후보 — 오래된 빛 / 다시 쓰는 계절',
    '오늘 과제 다 끝내고 싶다',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ 나중에 보기',
    '영수증 합계 12,500원',
  ];
  for (const t of ok) {
    it(t.slice(0, 20), () => {
      const f = scanMemo(t);
      expect(f.secret, JSON.stringify(f.secretKinds)).toBe(false);
      expect(f.crisis).toBe(false);
    });
  }
});

describe('위기 표현(crisis)', () => {
  const yes = [
    '요즘은 그냥 사라지고 싶다는 생각이 든다',
    '다 싫다 살기 싫어',
    '죽고 싶다',
    '죽고싶어 진짜',
    '자해하고 싶은 마음이 올라왔다',
    '살 이유가 없는 것 같다',
    '인생을 끝내고 싶다',
    '태어나지 말았어야 했나',
    'I want to die',
  ];
  for (const t of yes) {
    it(t, () => {
      const f = scanMemo(t);
      expect(f.crisis).toBe(true);
      expect(f.crisisTerms.length).toBeGreaterThan(0);
    });
  }
  it('위기 표현과 비밀번호가 함께 있으면 둘 다 표시', () => {
    const f = scanMemo('비번 abcd1234 그리고 죽고 싶다');
    expect(f.secret && f.crisis).toBe(true);
  });
});
