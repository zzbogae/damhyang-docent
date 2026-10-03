// core/mined_core/*.py 를 문자열로 번들에 넣는다. 브라우저 Pyodide 가 CLI 와 같은 코드를 실행하게 하려는 것.
const files = import.meta.glob('../../../core/mined_core/*.py', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const PY_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([p, src]) => [p.split('/').pop() as string, src]),
);
