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
import fluorite from '../assets/design/mineral_fluorite.webp';
import type { Mineral } from './minerals';

export const ART = { introFog, introPoster, logoLight, logoDark, mindiCharacter, pickaxe };

/**
 * 광물 9종 그림. 8/22 랜딩의 광물 12종(무작위 배치용, 이름 없음) 가운데 색이 가장 가까운 것을 골랐다.
 * 석류석은 맞는 붉은 광물이 없어 홍옥 그림의 색을 붉게 바꾼 임시본이다. 팀이 광물별 그림을 정하면 이 표만 바꾼다(NOW 열린 일 6).
 */
export const MINERAL_IMG: Record<Mineral, string> = {
  호박: amber, 황철석: pyrite, 청금석: lapis, 월장석: moonstone, 자수정: amethyst,
  홍옥: rose, 흑요석: obsidian, 석류석: garnet, 형석: fluorite,
};
