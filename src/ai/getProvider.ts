import { loadSettings } from '../settings/settings';
import { createGeminiProvider } from './gemini';
import { AiError, type AiProvider } from './provider';

export function getProvider(): AiProvider {
  const s = loadSettings();
  if (!s.geminiKey.trim()) throw new AiError('no-key');
  return createGeminiProvider({ apiKey: s.geminiKey.trim(), photoModel: s.photoModel });
}
