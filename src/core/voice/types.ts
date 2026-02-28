export type SpeechPriority = 'INTERRUPT' | 'QUEUE' | 'DROP';

export interface SpeechQueueItem {
  text: string;
  priority: SpeechPriority;
}
