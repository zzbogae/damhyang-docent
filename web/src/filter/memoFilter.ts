// 메모 필터: 기기 안에서만 돈다. 오탐보다 누락을 더 피하는 쪽으로 넓게 잡는다.
// secret: 화면에 절대 띄우지 않는 메모(자격증명·개인정보). crisis: 확인 후 열람 + 도움 안내(자살예방상담전화 109).

export type SecretKind =
  | 'password' | 'card' | 'account' | 'rrn' | 'phone' | 'email' | 'apikey' | 'private_key' | 'jwt' | 'url_token' | 'random_string';

export interface MemoFlags { secret: boolean; secretKinds: SecretKind[]; crisis: boolean; crisisTerms: string[] }

/** 도움 안내 문구(위기 표현이 걸린 원문을 열기 전에 보여 준다) */
export const CRISIS_HELP = '마음이 힘들 때는 자살예방상담전화 109(24시간)에서 이야기를 들어 줍니다.';

const ZW = /[\u200B-\u200D\uFEFF]/g;

// ------------------------------------------------------------ 자격증명·개인정보
const PASSWORD_KEY = /(비밀\s*번호|비번|패스\s*워드|암호|password|passwd|pass\s*word|pwd|p\/w|\bpw\b|핀\s*번호|\bpin\b|otp|인증\s*번호|보안\s*카드|와이파이|wi-?fi|wifi)/i;
// 키워드 뒤 20자 안에 공백 없는 토큰(숫자·영문·기호가 섞였거나 4자 이상 숫자)
const PASSWORD_VALUE = /^(?:[\s\p{P}\p{S}]|[은는이가요도])*([^\s,;。]{4,64})/u;

const API_KEY_PATTERNS: [SecretKind, RegExp][] = [
  ['apikey', /\bsk-(?:ant-|proj-|or-v1-)?[A-Za-z0-9_\-]{16,}/],
  ['apikey', /\bAKIA[0-9A-Z]{16}\b/],
  ['apikey', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['apikey', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['apikey', /\bxox[abprs]-[A-Za-z0-9\-]{10,}/],
  ['apikey', /\bAIza[0-9A-Za-z_\-]{30,}/],
  ['apikey', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY/],
  ['jwt', /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}/],
];

const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
// 전화: 휴대폰·지역번호·대표번호(1588 등)
const PHONE = /(?<!\d)(?:\+?82[\s\-.]?)?(?:0\d{1,2})[\s\-.)]?\d{3,4}[\s\-.]?\d{4}(?!\d)|\b1[5-9]\d{2}[\s\-]?\d{4}\b/;
const RRN = /(?<!\d)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\s?[-–]?\s?([1-8])\d{6}(?!\d)/;
const URL_TOKEN = /https?:\/\/\S*[?&#](?:token|access_token|auth|key|api_key|apikey|secret|sig|signature|password|pw|code|session|sid)=[^\s&]{6,}/i;
const BANK = /(은행|뱅크|계좌|입금|송금|국민|신한|우리|하나|농협|기업|카카오\s*뱅크|토스|케이\s*뱅크|새마을|우체국|수협|신협|씨티|SC제일|부산|대구|경남|광주|전북|제주|산업)/;

function luhn(digits: string) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

function findCards(text: string) {
  const re = /(?<!\d)(?:\d[ \-]?){13,19}(?!\d)/g;
  for (const m of text.matchAll(re)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length >= 13 && d.length <= 19 && luhn(d) && !/^(\d)\1+$/.test(d)) return true;
  }
  return false;
}

function isPhoneLike(groups: string) {
  return /^(?:0\d{1,2})-\d{3,4}-\d{4}$/.test(groups) || /^1[5-9]\d{2}-\d{4}$/.test(groups);
}

function isDateLike(groups: string) {
  return /^(19|20)\d{2}-\d{1,2}-\d{1,2}$/.test(groups) || /^\d{1,2}-\d{1,2}-(19|20)\d{2}$/.test(groups);
}

/** 계좌: 대시로 이은 숫자 묶음(합계 10~16자리)이 전화·날짜 형식이 아니면 계좌로 본다. 은행 이름 옆의 긴 숫자도. */
function findAccount(text: string) {
  for (const m of text.matchAll(/(?<![\d\-])\d{2,6}(?:-\d{2,7}){1,4}(?![\d\-])/g)) {
    const g = m[0];
    const n = g.replace(/-/g, '').length;
    if (n >= 10 && n <= 16 && !isPhoneLike(g) && !isDateLike(g)) return true;
  }
  if (BANK.test(text)) {
    for (const m of text.matchAll(/(?<!\d)\d{10,16}(?!\d)/g)) {
      if (!/^01[016789]\d{7,8}$/.test(m[0])) return true;
    }
  }
  return false;
}

function shannon(s: string) {
  const f = new Map<string, number>();
  for (const ch of s) f.set(ch, (f.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of f.values()) { const p = c / s.length; h -= p * Math.log2(p); }
  return h;
}

/** 무작위로 보이는 토큰(비밀번호·키를 앞뒤 설명 없이 적어 둔 경우) */
function findRandomString(text: string) {
  for (const tok of text.split(/[\s,;()[\]{}<>"'`]+/)) {
    if (tok.length < 10 || tok.length > 128) continue;
    if (/^https?:\/\//i.test(tok) || EMAIL.test(tok)) continue;
    if (/^[\d\-.:/]+$/.test(tok)) continue; // 날짜·전화·숫자만
    if (/[가-힣]/.test(tok)) continue;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(tok)).length;
    const h = shannon(tok);
    if ((classes >= 3 && h >= 3.0) || (classes >= 2 && tok.length >= 16 && h >= 3.5)) return true;
  }
  return false;
}

function findPassword(text: string) {
  const re = new RegExp(PASSWORD_KEY.source, 'gi');
  for (const m of text.matchAll(re)) {
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24);
    const v = PASSWORD_VALUE.exec(after)?.[1];
    if (!v) continue;
    // 한글만 있는 말(예: "비밀번호 바꿔야 함")은 값이 아니라 설명으로 본다
    if (/^[가-힣]+[.!?~]*$/.test(v)) continue;
    return true;
  }
  return false;
}

// ------------------------------------------------------------ 위기 표현 사전
// 과장 표현("죽고 싶을 만큼 맛있다")도 걸리지만, 누락보다 오탐이 낫다는 원칙에 따라 그대로 둔다.
const CRISIS: [string, RegExp][] = [
  ['죽고 싶다', /죽\s*고\s*싶|죽고\s*시퍼|죽어\s*버리고\s*싶|죽어\s*버릴\s*까|죽는\s*게\s*낫|죽을\s*까\s*(봐|싶|하)|차라리\s*죽|죽어야\s*(겠|할|하나)/],
  ['자살', /자살|극단\s*적\s*(인\s*)?선택|스스로\s*목숨|목숨을?\s*끊|생을\s*마감|세상을\s*등지/],
  ['자해', /자해|손목을?\s*긋|칼로\s*(손|팔|몸)|몸에\s*상처를?\s*(내|냈)|피가\s*나게\s*(긁|때)/],
  ['사라지고 싶다', /사라지고\s*싶|없어지고\s*싶|사라져\s*버리고\s*싶|사라졌으면|없어졌으면\s*좋겠|태어나지\s*말았어야|세상에\s*없었으면|나\s*같은\s*건\s*없어/],
  ['살기 싫다', /살기\s*싫|살고\s*싶지\s*않|사는\s*게\s*(의미|무의미|지옥)|살\s*이유가\s*없|살아\s*있을\s*이유|더\s*이상\s*못\s*살/],
  ['방법·준비', /목을?\s*매|투신|뛰어\s*내리고\s*싶|번개탄|수면제를?\s*(모아|모았|잔뜩|한\s*번에|많이)|유서|마지막\s*편지를?\s*(쓰|썼)/],
  ['끝내고 싶다', /(인생|삶|내\s*삶|모든\s*걸|모든\s*것|이\s*생)\s*(을|를)?\s*끝내고\s*싶|(인생|삶|모든\s*걸)\s*(을|를)?\s*끝내\s*버리고\s*싶/],
  ['영어', /\b(suicid|kill myself|want to die|self[\s-]?harm|end my life)\w*/i],
];

export function scanMemo(raw: string): MemoFlags {
  const text = (raw ?? '').normalize('NFC').replace(ZW, '');
  const kinds = new Set<SecretKind>();
  if (findPassword(text)) kinds.add('password');
  if (findCards(text)) kinds.add('card');
  if (RRN.test(text)) kinds.add('rrn');
  if (findAccount(text)) kinds.add('account');
  if (PHONE.test(text)) kinds.add('phone');
  if (EMAIL.test(text)) kinds.add('email');
  for (const [k, re] of API_KEY_PATTERNS) if (re.test(text)) kinds.add(k);
  if (URL_TOKEN.test(text)) kinds.add('url_token');
  if (findRandomString(text)) kinds.add('random_string');

  const crisisTerms = CRISIS.filter(([, re]) => re.test(text)).map(([t]) => t);
  return { secret: kinds.size > 0, secretKinds: [...kinds], crisis: crisisTerms.length > 0, crisisTerms };
}

/** MemoRecord.flags 에 넣을 형태(crisisTerms 는 저장하지 않는다) */
export function toMemoFlags(f: MemoFlags) {
  return { secret: f.secret, secretKinds: f.secretKinds as string[], crisis: f.crisis };
}
