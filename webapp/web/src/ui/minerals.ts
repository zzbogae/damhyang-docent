// 광물 9종(팀 9/23 §1-4): 축 × 방향 8종 + 복합 1종(형석). 색은 드라이브 광물 그림(design.ts MINERAL_IMG)의 대표색이다.
import type { Axis } from '../types';

export const MINERALS = ['호박', '황철석', '청금석', '월장석', '자수정', '홍옥', '흑요석', '석류석', '형석'] as const;
export type Mineral = (typeof MINERALS)[number];

export const MINERAL_EN: Record<Mineral, string> = {
  호박: 'amber', 황철석: 'pyrite', 청금석: 'lapis', 월장석: 'moonstone', 자수정: 'amethyst',
  홍옥: 'rose', 흑요석: 'obsidian', 석류석: 'garnet', 형석: 'fluorite',
};

export const MINERAL_HEX: Record<Mineral, string> = {
  호박: '#F2A33A', 황철석: '#C9A26B', 청금석: '#3F6FD0', 월장석: '#9CC3EE', 자수정: '#9A5BE0',
  홍옥: '#EE8FB0', 흑요석: '#8E95A8', 석류석: '#C4243C', 형석: '#5CCB9A',
};
export const MINERAL_COLOR: Record<string, string> = MINERAL_HEX;

export const MINERAL_BY_AXIS_DIR: Record<Axis, { up: Mineral; down: Mineral }> = {
  move: { up: '호박', down: '황철석' }, rest: { up: '청금석', down: '월장석' },
  watch: { up: '자수정', down: '홍옥' }, leave: { up: '흑요석', down: '석류석' },
};
