// "샘플로 시작": public/sample 의 합성 인물 원천 파일 한 벌을 File 로 가져온다(실제 기록 아님).
import type { ImportInput } from './sources';

export interface SampleManifest {
  persona: string;
  notice: string;
  files: { url: string; name: string; path: string; type: string; size: number }[];
}

export async function loadSampleInputs(base = `${import.meta.env?.BASE_URL ?? '/'}sample/`): Promise<{ manifest: SampleManifest; inputs: ImportInput[] }> {
  const manifest = (await (await fetch(`${base}manifest.json`)).json()) as SampleManifest;
  const inputs = await Promise.all(
    manifest.files.map(async (f) => {
      const blob = await (await fetch(base + f.url)).blob();
      return { file: new File([blob], f.name, { type: f.type }), path: f.path };
    }),
  );
  return { manifest, inputs };
}
