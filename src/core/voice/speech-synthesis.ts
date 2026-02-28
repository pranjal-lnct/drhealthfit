import type { SpeechPriority } from './types';
import { SPEECH_UTTERANCE_TIMEOUT_MS } from '@/config/constants';

interface QueuedUtterance {
  text: string;
  priority: SpeechPriority;
}

let isSpeaking = false;
let queue: QueuedUtterance[] = [];
let currentTimeout: ReturnType<typeof setTimeout> | null = null;

function getsynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

function speakNext(): void {
  const synth = getsynth();
  if (!synth || queue.length === 0) {
    isSpeaking = false;
    return;
  }

  const item = queue.shift()!;
  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  isSpeaking = true;

  utterance.onend = () => {
    clearTimeoutSafe();
    isSpeaking = false;
    speakNext();
  };

  utterance.onerror = () => {
    clearTimeoutSafe();
    isSpeaking = false;
    speakNext();
  };

  // Safety timeout — Web Speech API can freeze on mobile (see Coding Standards 8.3)
  currentTimeout = setTimeout(() => {
    synth.cancel();
    isSpeaking = false;
    speakNext();
  }, SPEECH_UTTERANCE_TIMEOUT_MS);

  synth.speak(utterance);
}

function clearTimeoutSafe(): void {
  if (currentTimeout !== null) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
}

export function speak(text: string, priority: SpeechPriority): void {
  const synth = getsynth();
  if (!synth) return;

  switch (priority) {
    case 'INTERRUPT':
      synth.cancel();
      clearTimeoutSafe();
      isSpeaking = false;
      queue = [{ text, priority }]; // Clear queue, this goes first
      speakNext();
      break;

    case 'QUEUE':
      queue.push({ text, priority });
      if (!isSpeaking) speakNext();
      break;

    case 'DROP':
      if (!isSpeaking) {
        queue.push({ text, priority });
        speakNext();
      }
      // Otherwise silently discard
      break;
  }
}

export function cancelAllSpeech(): void {
  const synth = getsynth();
  synth?.cancel();
  clearTimeoutSafe();
  queue = [];
  isSpeaking = false;
}

export function isSpeechActive(): boolean {
  return isSpeaking;
}
