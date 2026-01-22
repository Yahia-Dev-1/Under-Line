// Accent-specific Text-to-Speech utility functions
import { languageCodes } from './wordTranslator';

// Mapping of language codes to accent-specific voices (if available)
const accentVoiceMap = {
  'ar': ['ar-SA', 'ar-EG', 'ar-AE'], // Arabic: Saudi, Egyptian, Emirati accents
  'en': ['en-US', 'en-GB', 'en-AU', 'en-IN'], // English: American, British, Australian, Indian accents
  'fr': ['fr-FR', 'fr-CA'], // French: France, Canadian accents
  'es': ['es-ES', 'es-MX', 'es-AR'], // Spanish: Spain, Mexican, Argentinian accents
  'de': ['de-DE', 'de-AT', 'de-CH'], // German: Germany, Austrian, Swiss accents
  'it': ['it-IT'], // Italian: Italy
  'pt': ['pt-PT', 'pt-BR'], // Portuguese: Portugal, Brazil accents
  'ru': ['ru-RU'], // Russian: Russia
  'zh': ['zh-CN', 'zh-TW'], // Chinese: Simplified, Traditional accents
  'ja': ['ja-JP'], // Japanese: Japan
  'ko': ['ko-KR'], // Korean: South Korea
  'hi': ['hi-IN'], // Hindi: India
  'th': ['th-TH'], // Thai: Thailand
  'tr': ['tr-TR'], // Turkish: Turkey
  'nl': ['nl-NL'], // Dutch: Netherlands
  'sv': ['sv-SE'], // Swedish: Sweden
  'pl': ['pl-PL'], // Polish: Poland
  'cs': ['cs-CZ'], // Czech: Czech Republic
};

/**
 * Speak text with accent-specific pronunciation based on language
 */
export const speakWithAccent = async (text, languageCode = 'en') => {
  // Normalize the language code
  const normalizedLangCode = languageCode.toLowerCase().slice(0, 2);
  
  // Get the appropriate accent variants for this language
  const accentVariants = accentVoiceMap[normalizedLangCode] || [normalizedLangCode];
  
  // Try to speak with the language-specific accent
  return await speakWithSpecificAccent(text, accentVariants);
};

/**
 * Internal function to try speaking with specific accent variants
 */
const speakWithSpecificAccent = (text, accentVariants) => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text) {
      resolve({ success: false });
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Wait for voices to load
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        voices = window.speechSynthesis.getVoices();
        trySpeakWithAccentVariants(text, accentVariants, voices, resolve);
      });
      return;
    }

    trySpeakWithAccentVariants(text, accentVariants, voices, resolve);
  });
};

/**
 * Helper function to try each accent variant until one works
 */
const trySpeakWithAccentVariants = (text, accentVariants, voices, resolve) => {
  let success = false;

  for (const accentCode of accentVariants) {
    const filteredVoices = voices.filter(voice => 
      voice.lang.toLowerCase().includes(accentCode.split('-')[0]) && 
      (accentCode.includes('-') ? voice.lang.toLowerCase().includes(accentCode.split('-')[1]) : true)
    );

    // Prioritize high-quality voices
    const preferredVoices = filteredVoices.filter(voice => 
      voice.name.toLowerCase().includes('google') || 
      voice.name.toLowerCase().includes('natural') ||
      voice.name.toLowerCase().includes('premium')
    );

    const voice = preferredVoices[0] || filteredVoices[0];

    if (voice) {
      success = true;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = accentCode;
      utterance.rate = 0.9; // Slightly slower for clearer pronunciation
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        console.log(`✅ Speech with accent ${accentCode} finished for:`, text.substring(0, 30) + '...');
        resolve({ success: true, accentUsed: accentCode });
      };

      utterance.onerror = (e) => {
        console.error(`❌ Speech error with accent ${accentCode}:`, e);
        // Try the next accent variant
        resolve({ success: false, error: e });
      };

      console.log(`🎤 Speaking with accent ${accentCode} for:`, text.substring(0, 50) + '...');
      window.speechSynthesis.speak(utterance);
      break; // Use the first available voice
    }
  }

  // If no specific voice was found, try the default approach with the language code
  if (!success) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accentVariants[0]; // Use the primary accent code
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      console.log(`✅ Default speech with accent ${accentVariants[0]} finished for:`, text.substring(0, 30) + '...');
      resolve({ success: true, accentUsed: accentVariants[0] });
    };

    utterance.onerror = (e) => {
      console.error(`❌ Default speech error with accent ${accentVariants[0]}:`, e);
      resolve({ success: false, error: e });
    };

    console.log(`🎤 Speaking with default accent ${accentVariants[0]} for:`, text.substring(0, 50) + '...');
    window.speechSynthesis.speak(utterance);
  }
};

/**
 * Get available accents for a specific language
 */
export const getAvailableAccents = (languageCode) => {
  const normalizedLangCode = languageCode.toLowerCase().slice(0, 2);
  return accentVoiceMap[normalizedLangCode] || [languageCode];
};

/**
 * Speak text with auto-detected language accents
 */
export const speakAutoDetectAccent = async (text) => {
  // This would typically call a language detection API
  // For now, we'll use a simplified approach
  const detectedLang = detectLanguageSimple(text);
  return await speakWithAccent(text, detectedLang);
};

/**
 * Simple language detection based on character sets and common words
 */
const detectLanguageSimple = (text) => {
  const trimmedText = text.trim().substring(0, 100).toLowerCase();
  
  // Arabic script detection
  if (/[؀-ۿ]/.test(trimmedText)) {
    return 'ar';
  }
  
  // Chinese characters detection
  if (/[一-鿿]/.test(trimmedText)) {
    return 'zh';
  }
  
  // Japanese characters detection
  if (/[぀-ゟ゠-ヿ]/.test(trimmedText)) {
    return 'ja';
  }
  
  // Korean characters detection
  if (/[가-힯]/.test(trimmedText)) {
    return 'ko';
  }
  
  // Hindi/Devanagari detection
  if (/[ऀ-ॿ]/.test(trimmedText)) {
    return 'hi';
  }
  
  // Thai characters detection
  if (/[฀-๿]/.test(trimmedText)) {
    return 'th';
  }
    
  // Czech characters detection
  if (/[ČčŠšŽžŘřŤťŇňĎďĚěŮů]/.test(trimmedText)) {
    return 'cs';
  }
    
  // For European languages, we might need more sophisticated detection
  // But for now, default to English
  return 'en';
};