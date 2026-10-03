import { useStore } from '../state/store';

const URL_EN = typeof location !== 'undefined' && new URLSearchParams(location.search).has('en');

/** 영어 자막을 보여 줄지(설정 또는 주소의 ?en) */
export function useEn(): boolean {
  const { settings } = useStore();
  return URL_EN || !!settings.subtitleEn;
}
