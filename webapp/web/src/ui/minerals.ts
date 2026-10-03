// 광물 9종(팀 9/23 §1-4): 축 × 방향 8종 + 복합 1종(형석). 색은 드라이브 핸드오프 gems.css 의 --gem-* 값이다.
import type { Axis } from '../types';

export const MINERALS = ['호박', '황철석', '청금석', '월장석', '자수정', '홍옥', '흑요석', '석류석', '형석'] as const;
export type Mineral = (typeof MINERALS)[number];

export const MINERAL_EN: Record<Mineral, string> = {
  호박: 'amber', 황철석: 'pyrite', 청금석: 'lapis', 월장석: 'moonstone', 자수정: 'amethyst',
  홍옥: 'rose', 흑요석: 'obsidian', 석류석: 'garnet', 형석: 'fluorite',
};

export const MINERAL_HEX: Record<Mineral, string> = {
  호박: '#d99a3f', 황철석: '#e8c45f', 청금석: '#5a94d6', 월장석: '#cfe0e8', 자수정: '#a17fd1',
  홍옥: '#e88ab5', 흑요석: '#8b87a0', 석류석: '#e0705f', 형석: '#6fc79a',
};
export const MINERAL_COLOR: Record<string, string> = MINERAL_HEX;

export const MINERAL_BY_AXIS_DIR: Record<Axis, { up: Mineral; down: Mineral }> = {
  move: { up: '호박', down: '황철석' }, rest: { up: '청금석', down: '월장석' },
  watch: { up: '자수정', down: '홍옥' }, leave: { up: '흑요석', down: '석류석' },
};
