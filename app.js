const API_KEY_STORAGE = 'damhyang_api_key';
let currentScene = null;
let isTyping = false;

// ── Utility ──────────────────────────────────────────────

function hex2rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Screen transitions ────────────────────────────────────

function showScreen(id) {
  const all = document.querySelectorAll('.screen');
  const next = document.getElementById(id);

  all.forEach(s => {
    if (s.classList.contains('visible')) {
      s.classList.remove('visible');
      setTimeout(() => {
        s.classList.remove('active');
      }, 600);
    }
  });

  setTimeout(() => {
    next.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.add('visible');
      });
    });
  }, 50);
}

// ── API Key ───────────────────────────────────────────────

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE);
}

function saveApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

function showApiKeyModal() {
  showScreen('screen-apikey');
  setTimeout(() => {
    document.getElementById('api-key-input').focus();
  }, 700);
}

// ── Claude API ────────────────────────────────────────────

async function askPhoenix(scene) {
  const apiKey = getApiKey();
  if (!apiKey) {
    showApiKeyModal();
    return null;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `너는 백제금동대향로의 봉황이다.
1400년을 금속 안에서 보았다.
손에서 손으로 건너온 기억을 품고 있다.
말할 때는 짧고 느리게. 시적으로.
감탄사나 설명 없이 — 장면만 말한다.
한국어로. 3~5문장.
마침표 대신 줄바꿈으로 끊는다.`,
      messages: [
        { role: 'user', content: scene.prompt }
      ]
    })
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(API_KEY_STORAGE);
      showApiKeyModal();
      return null;
    }
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Typing Effect ─────────────────────────────────────────

function typeText(el, text, onDone) {
  isTyping = true;
  el.textContent = '';
  const chars = [...text];
  let i = 0;

  const interval = setInterval(() => {
    if (i < chars.length) {
      el.textContent += chars[i];
      i++;
    } else {
      clearInterval(interval);
      isTyping = false;
      if (onDone) onDone();
    }
  }, 60);
}

// ── Scene Cards ───────────────────────────────────────────

function renderScenes() {
  const list = document.getElementById('scene-list');
  list.innerHTML = '';

  SCENES.forEach(scene => {
    const li = document.createElement('li');
    li.className = 'scene-card';
    li.style.background = hex2rgba(scene.color, 0.15);
    li.style.borderColor = hex2rgba(scene.color, 0.4);

    li.innerHTML = `
      <div class="scene-color-bar" style="background: ${scene.color};"></div>
      <div class="scene-card-inner">
        <div class="scene-year" style="color: ${scene.color};">${scene.year}</div>
        <div class="scene-name">${scene.name}</div>
        <div class="scene-desc">${scene.desc}</div>
      </div>
    `;

    li.addEventListener('mouseenter', () => {
      li.style.background = hex2rgba(scene.color, 0.25);
    });
    li.addEventListener('mouseleave', () => {
      li.style.background = hex2rgba(scene.color, 0.15);
    });

    li.addEventListener('click', () => showDocent(scene));
    list.appendChild(li);
  });
}

// ── Docent Screen ─────────────────────────────────────────

function showDocent(scene) {
  currentScene = scene;

  document.getElementById('docent-year').textContent = scene.year;
  document.getElementById('docent-name').textContent = scene.name;
  document.getElementById('docent-texture').textContent = scene.texture;
  document.getElementById('docent-response').textContent = '';

  const askBtn = document.getElementById('btn-ask');
  const nextBtn = document.getElementById('btn-next');

  askBtn.style.display = 'inline-block';
  askBtn.disabled = false;
  nextBtn.style.display = 'none';

  showScreen('screen-docent');
}

async function handleAsk() {
  if (isTyping || !currentScene) return;

  const askBtn = document.getElementById('btn-ask');
  const responseEl = document.getElementById('docent-response');
  const nextBtn = document.getElementById('btn-next');

  askBtn.disabled = true;
  responseEl.textContent = '';
  nextBtn.style.display = 'none';

  try {
    const text = await askPhoenix(currentScene);
    if (!text) {
      askBtn.disabled = false;
      return;
    }

    typeText(responseEl, text, () => {
      askBtn.disabled = false;

      if (currentScene.id === 'hand_07') {
        nextBtn.textContent = '마지막 문을 열다';
      } else {
        nextBtn.textContent = '다른 손으로';
      }
      nextBtn.style.display = 'inline-block';
    });

  } catch (err) {
    responseEl.textContent = '봉황이 아직 말할 준비가 되지 않았습니다';
    askBtn.disabled = false;
  }
}

function handleNext() {
  if (!currentScene) return;

  if (currentScene.id === 'hand_07') {
    showEnding();
  } else {
    showScreen('screen-scenes');
  }
}

// ── Ending ────────────────────────────────────────────────

function showEnding() {
  showScreen('screen-ending');

  const endingText = document.getElementById('ending-text');
  endingText.classList.remove('fade-in');

  setTimeout(() => {
    endingText.classList.add('fade-in');
  }, 100);

  setTimeout(() => {
    showScreen('screen-main');
  }, 8000);
}

// ── Init ──────────────────────────────────────────────────

function init() {
  renderScenes();

  // API Key modal
  document.getElementById('btn-start').addEventListener('click', () => {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    if (!key) return;
    saveApiKey(key);
    showScreen('screen-main');
  });

  document.getElementById('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-start').click();
    }
  });

  // Main landing
  document.getElementById('screen-main').addEventListener('click', () => {
    showScreen('screen-scenes');
  });

  // Back nav
  document.getElementById('btn-back-scenes').addEventListener('click', () => {
    showScreen('screen-main');
  });

  document.getElementById('btn-back-docent').addEventListener('click', () => {
    showScreen('screen-scenes');
  });

  // Docent actions
  document.getElementById('btn-ask').addEventListener('click', handleAsk);
  document.getElementById('btn-next').addEventListener('click', handleNext);

  // Entry point
  if (getApiKey()) {
    showScreen('screen-main');
  } else {
    showScreen('screen-apikey');
  }
}

document.addEventListener('DOMContentLoaded', init);
