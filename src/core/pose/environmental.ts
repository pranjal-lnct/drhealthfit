import {
  ENV_MIN_BRIGHTNESS,
  ENV_MAX_BRIGHTNESS,
} from '@/config/constants';

export interface EnvironmentalResult {
  avgBrightness: number;
  contrastRatio: number;
  isAcceptable: boolean;
  issue: 'too_dark' | 'backlit' | null;
}

/**
 * Analyze a video frame for lighting conditions.
 * Draws to a small hidden canvas for performance (160×120).
 * See PRD Section 11.7.
 */
export function analyzeEnvironment(
  imageData: ImageData,
): EnvironmentalResult {
  const { data } = imageData;
  const pixelCount = data.length / 4;

  let sumLuminance = 0;
  let sumLuminanceSq = 0;

  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 luminance
    const luminance = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    sumLuminance += luminance;
    sumLuminanceSq += luminance * luminance;
  }

  const avgBrightness = sumLuminance / pixelCount;
  const variance = sumLuminanceSq / pixelCount - avgBrightness ** 2;
  const stddev = Math.sqrt(Math.max(0, variance));
  const contrastRatio = avgBrightness > 0 ? stddev / avgBrightness : 0;

  if (avgBrightness < ENV_MIN_BRIGHTNESS) {
    return { avgBrightness, contrastRatio, isAcceptable: false, issue: 'too_dark' };
  }

  if (avgBrightness > ENV_MAX_BRIGHTNESS) {
    return { avgBrightness, contrastRatio, isAcceptable: false, issue: 'backlit' };
  }

  return { avgBrightness, contrastRatio, isAcceptable: true, issue: null };
}
