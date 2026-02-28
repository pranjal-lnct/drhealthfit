import { create } from 'zustand';

interface VoiceState {
  isEnabled: boolean;
  isSpeaking: boolean;
  toggle: () => void;
  setSpeaking: (speaking: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isEnabled: true,
  isSpeaking: false,
  toggle: () => set((s) => ({ isEnabled: !s.isEnabled })),
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
}));
