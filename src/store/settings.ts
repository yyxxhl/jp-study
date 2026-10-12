import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CardFront = 'ja' | 'zh';

interface SettingsState {
  /** 卡片正面：日文（汉字优先）或中文 */
  cardFront: CardFront;
  /** 卡片正面是否同时显示假名（有汉字时） */
  showKanaOnFront: boolean;
  /** 翻面后自动朗读 */
  autoSpeak: boolean;
  ttsRate: number;
  /** 每次复习最多新词数 */
  newPerSession: number;
  /** 每套练习题数 */
  exerciseCount: number;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      cardFront: 'ja',
      showKanaOnFront: false,
      autoSpeak: true,
      ttsRate: 0.9,
      newPerSession: 10,
      exerciseCount: 10,
      set: (patch) => set(patch),
    }),
    { name: 'jp-study-settings' },
  ),
);
