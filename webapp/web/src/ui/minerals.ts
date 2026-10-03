// 광물 9종(팀 9/23 §1-4): 축 × 방향 8종 + 복합 1종(형석). 색은 자리표시이며, 하빈 님 디자인 시스템(gems.js)을 병합하면 그 값으로 바꾼다.
import type { Axis } from '../types';

export const MINERALS = ['호박', '황철석', '청금석', '월장석', '자수정', '홍옥', '흑요석', '석류석', '형석'] as const;
export type Mineral = (typeof MINERALS)[number];

export const MINERAL_EN: Record<Mineral, string> = {
  호박: 'amber', 황철석: 'pyrite', 청금석: 'lapis', 월장석: 'moonstone', 자수정: 'amethyst',
  홍옥: 'rose', 흑요석: 'obsidian', 석류석: 'garnet', 형석: 'fluorite',
};

export const MINERAL_HEX: Record<Mineral, string> = {
  호박: '#a86a12', 황철석: '#8a7a3a', 청금석: '#2c5c8a', 월장석: '#8f9bb0', 자수정: '#6f5a8f',
  홍옥: '#a8445a', 흑요석: '#2b2931', 석류석: '#7a1f2b', 형석: '#3f8a7a',
};
export const MINERAL_COLOR: Record<string, string> = MINERAL_HEX;

export const MINERAL_BY_AXIS_DIR: Record<Axis, { up: Mineral; down: Mineral }> = {
  move: { up: '호박', down: '황철석' }, rest: { up: '청금석', down: '월장석' },
  watch: { up: '자수정', down: '홍옥' }, leave: { up: '흑요석', down: '석류석' },
};
