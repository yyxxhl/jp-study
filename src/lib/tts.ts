/** 基于 Web Speech API 的日语朗读 */

let cachedVoice: SpeechSynthesisVoice | null | undefined;

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  if (!ttsSupported()) return (cachedVoice = null);
  const voices = window.speechSynthesis.getVoices();
  const ja = voices.filter((v) => /^ja/i.test(v.lang));
  if (ja.length === 0) {
    // 语音列表可能异步加载，不缓存 null
    return null;
  }
  const preferred =
    ja.find((v) => /Google|Kyoko|O-ren|Nanami|Haruka|Ayumi|Ichiro/i.test(v.name)) ?? ja[0];
  cachedVoice = preferred;
  return preferred;
}

if (ttsSupported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined;
  };
}

/** 去掉教材分词空格、说话人标签和括号备注，便于朗读 */
export function cleanForSpeech(text: string) {
  return text
    .replace(/^[A-ZＡ-Ｚ]：/gm, '')
    .replace(/／.*$/gm, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/〜/g, '');
}

export function speak(text: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = 'ja-JP';
    u.rate = rate;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function hasJapaneseVoice() {
  return pickVoice() !== null;
}
