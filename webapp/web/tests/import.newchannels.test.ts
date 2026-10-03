// 인스타그램(깨진 한글 되살리기, 게시·DM, "나" 찾기)과 AI 대화(ChatGPT·Claude) 파서.
import { describe, expect, it } from 'vitest';
import { Aggregator } from '../src/import/aggregate';
import { fixMojibake, InstagramAcc } from '../src/import/parsers/instagram';
import { parseAiConversations } from '../src/import/parsers/aichat';
import { classify } from '../src/import/router';

/** 인스타그램이 쓰는 방식으로 한글을 깨뜨린다(UTF-8 바이트를 한 글자씩). */
const mangle = (s: string) => String.fromCharCode(...new TextEncoder().encode(s));

describe('인스타그램', () => {
  it('깨진 한글을 되살리고 정상 글자는 그대로 둔다', () => {
    expect(fixMojibake(mangle('안녕 반가워'))).toBe('안녕 반가워');
    expect(fixMojibake('hello')).toBe('hello');
    expect(fixMojibake('이미 정상')).toBe('이미 정상');
  });

  it('게시·스토리·릴스와 내가 보낸 DM 만 센다', () => {
    const ig = new InstagramAcc();
    // 2024-03-05 01:30 KST = 2024-03-04 16:30 UTC
    const t1 = Date.UTC(2024, 2, 4, 16, 30) / 1000;
    const t2 = Date.UTC(2024, 2, 5, 3, 0) / 1000;
    expect(ig.addContent(JSON.stringify([{ media: [{ uri: 'a.jpg', creation_timestamp: t1, title: mangle('바다') }] }]))).toBe(1);
    expect(ig.addContent(JSON.stringify({ ig_stories: [{ uri: 's.jpg', creation_timestamp: t2 }] }))).toBe(1);
    expect(ig.addContent(JSON.stringify({ ig_reels_media: [{ media: [{ creation_timestamp: t2 }] }] }))).toBe(1);
    const me = mangle('한도윤');
    const other = mangle('김서연');
    ig.addMessages(JSON.stringify({ participants: [{ name: other }, { name: me }], messages: [
      { sender_name: me, timestamp_ms: t1 * 1000, content: mangle('잘 자') },
      { sender_name: other, timestamp_ms: t1 * 1000 - 60000, content: 'hi' },
      { sender_name: me, timestamp_ms: t2 * 1000, content: 'ok' },
    ] }), 'a');
    ig.addMessages(JSON.stringify({ participants: [{ name: mangle('박준호') }, { name: me }], messages: [] }), 'b');
    expect(ig.me()).toBe('한도윤'); // 두 대화방 모두에 있는 사람
    const agg = new Aggregator();
    expect(ig.flush(agg)).toBe(5);
    const { daily, meta } = agg.finalize();
    expect(daily).toEqual([{ date: '2024-03-05', sns_dm_n: 2, sns_dm_night_n: 1, sns_post_n: 3 }]);
    expect(meta.channels.sns?.sources).toEqual(['instagram']);
  });

  it('프로필 이름이 있으면 그 사람을 나로 본다', () => {
    const ig = new InstagramAcc();
    ig.addProfile(JSON.stringify({ profile_user: [{ string_map_data: { Name: { value: mangle('서지안') } } }] }));
    expect(ig.me()).toBe('서지안');
  });

  it('경로 판별: 인스타그램 올린 사진 파일은 사진 채널에 넣지 않는다', () => {
    expect(classify('instagram-x/your_instagram_activity/content/posts_1.json')).toBe('ig-content');
    expect(classify('instagram-x/your_instagram_activity/messages/inbox/kim_123/message_1.json')).toBe('ig-message');
    expect(classify('instagram-x/personal_information/personal_information/personal_information.json')).toBe('ig-profile');
    expect(classify('instagram-x/media/posts/202403/abc.jpg')).toBe('ignore');
    expect(classify('chatgpt-export/conversations.json')).toBe('ai-conversations');
  });
});

describe('AI 대화', () => {
  it('ChatGPT: 사용자 메시지만, 숨긴 메시지는 빼고 센다', () => {
    const agg = new Aggregator();
    const t = Date.UTC(2024, 2, 4, 17, 0) / 1000; // 3월 5일 02:00 KST
    const r = parseAiConversations(JSON.stringify([{ title: 'x', create_time: t, mapping: {
      a: { message: { author: { role: 'system' }, create_time: t, content: { parts: ['sys'] } } },
      b: { message: { author: { role: 'user' }, create_time: t + 1, content: { parts: ['안녕하세요'] } } },
      c: { message: { author: { role: 'assistant' }, create_time: t + 2, content: { parts: ['네'] } } },
      d: { message: { author: { role: 'user' }, create_time: t + 3, content: { parts: ['숨김'] }, metadata: { is_visually_hidden_from_conversation: true } } },
      e: { message: null },
    } }]), agg);
    expect(r).toEqual({ messages: 1, app: 'chatgpt' });
    expect(agg.finalize().daily).toEqual([{ date: '2024-03-05', ai_chars: 5, ai_msg_n: 1, ai_msg_night_n: 1 }]);
  });

  it('Claude: human 메시지만 센다', () => {
    const agg = new Aggregator();
    const r = parseAiConversations(JSON.stringify([{ uuid: 'u', name: 'n', chat_messages: [
      { sender: 'human', created_at: '2025-06-01T12:00:00.000Z', text: '요약해 줘' },
      { sender: 'assistant', created_at: '2025-06-01T12:00:05.000Z', text: '네' },
      { sender: 'human', created_at: '2025-06-01T13:00:00.000Z', text: '', content: [{ type: 'text', text: '고마워' }] },
    ] }]), agg);
    expect(r).toEqual({ messages: 2, app: 'claude' });
    const { daily, meta } = agg.finalize();
    expect(daily).toEqual([{ date: '2025-06-01', ai_chars: 8, ai_msg_n: 2 }]);
    expect(meta.channels.ai?.sources).toEqual(['claude']);
  });

  it('다른 conversations.json 은 건너뛴다', () => {
    expect(parseAiConversations('{"a":1}', new Aggregator()).app).toBeNull();
  });
});
