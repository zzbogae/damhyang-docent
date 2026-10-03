// 팀 디자인 에셋(드라이브 기준): 8/22 랜딩(입장 인트로·민디 소개·광물 지하), Mine-D UI 시트(9/7), 웹 데모 v5(10/3) 에서 꺼낸 그림.
// 팀 저장소 .gitignore 가 png·jpg·mp4 를 막아서 webp·webm 으로 바꿔 넣었다. 원본은 드라이브에 있다.
import introFog from '../assets/design/intro_fog.webm';
import introPoster from '../assets/design/intro_fog_poster.webp';
import logoLight from '../assets/design/logo_light.webp';
import logoDark from '../assets/design/logo_dark.webp';
import mindiCharacter from '../assets/design/mindi_character.webp';
import pickaxe from '../assets/design/pickaxe.webp';
import amber from '../assets/design/mineral_amber.webp';
import pyrite from '../assets/design/mineral_pyrite.webp';
import lapis from '../assets/design/mineral_lapis.webp';
import moonstone from '../assets/design/mineral_moonstone.webp';
import amethyst from '../assets/design/mineral_amethyst.webp';
import rose from '../assets/design/mineral_rose.webp';
import obsidian from '../assets/design/mineral_obsidian.webp';
import garnet from '../assets/design/mineral_garnet.webp';
import st2021 from '../assets/design/stratum_2021.webp';
import st2022 from '../assets/design/stratum_2022.webp';
import st2023 from '../assets/design/stratum_2023.webp';
import st2024 from '../assets/design/stratum_2024.webp';
import st2025 from '../assets/design/stratum_2025.webp';
import st2026 from '../assets/design/stratum_2026.webp';
import fluorite from '../assets/design/mineral_fluorite.webp';
import type { Mineral } from './minerals';

export const ART = { introFog, introPoster, logoLight, logoDark, mindiCharacter, pickaxe };

/**
 * 광물 9종 그림: 드라이브 Team Art Assets / 03 앱 지층 / Mine-D_핸드오프.zip 의 gems/png(@3x) 그대로.
 * 이름·색은 핸드오프 gems.css 의 --gem-* 와 같다. 어느 주에 어느 광물이 나오는지는 핸드오프의 pickGem(주차 무작위)이 아니라
 * 팀 9/23 확정 규칙(가장 크게 벗어난 축 × 방향, 여러 축이면 형석)을 따른다.
 */
export const MINERAL_IMG: Record<Mineral, string> = {
  호박: amber, 황철석: pyrite, 청금석: lapis, 월장석: moonstone, 자수정: amethyst,
  홍옥: rose, 흑요석: obsidian, 석류석: garnet, 형석: fluorite,
};

/** 연도별 지층 그림(드라이브 Team Art Assets / 03 앱 지층 / stratum-2021~2026.png, 10/3). 그림이 없는 해(2020 이전)는 여섯 장을 차례로 돌려 쓴다. */
const STRATUM: Record<number, string> = { 2021: st2021, 2022: st2022, 2023: st2023, 2024: st2024, 2025: st2025, 2026: st2026 };
export function stratumFor(year: number): { src: string; own: boolean } {
  if (STRATUM[year]) return { src: STRATUM[year], own: true };
  const keys = [2021, 2022, 2023, 2024, 2025, 2026];
  return { src: STRATUM[keys[((year % 6) + 6) % 6]], own: false };
}
