// Utility function to translate individual words to any language
export const translateWord = async (word, targetLangCode) => {
  try {
    // Use Google Translate API for real-time translation
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(word)}`
    );
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    const translation = data[0]?.[0]?.[0];
    
    if (!translation) {
      throw new Error('No translation found');
    }
    
    return translation.trim();
  } catch (error) {
    console.error('Translation error:', error);
    // Return a fallback message if translation fails
    return `[${targetLangCode.toUpperCase()} translation needed: ${word}]`;
  }
};

// Language code mapping
export const languageCodes = {
  'arabic': 'ar',
  'czech': 'cs',
  'german': 'de',
  'english': 'en',
  'french': 'fr',
  'spanish': 'es',
  'italian': 'it',
  'portuguese': 'pt',
  'russian': 'ru',
  'chinese': 'zh',
  'japanese': 'ja',
  'korean': 'ko',
  'turkish': 'tr',
  'polish': 'pl',
  'dutch': 'nl',
  'swedish': 'sv',
  'norwegian': 'no',
  'danish': 'da',
  'finnish': 'fi',
  'greek': 'el',
  'hungarian': 'hu',
  'thai': 'th',
  'vietnamese': 'vi',
  'indonesian': 'id',
  'hebrew': 'he',
  'hindi': 'hi',
  'urdu': 'ur',
  'persian': 'fa',
  'ar': 'ar',
  'cs': 'cs',
  'de': 'de',
  'en': 'en',
  'fr': 'fr',
  'es': 'es',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'zh': 'zh',
  'ja': 'ja',
  'ko': 'ko',
  'tr': 'tr',
  'pl': 'pl',
  'nl': 'nl',
  'sv': 'sv',
  'no': 'no',
  'da': 'da',
  'fi': 'fi',
  'el': 'el',
  'hu': 'hu',
  'th': 'th',
  'vi': 'vi',
  'id': 'id',
  'he': 'he',
  'hi': 'hi',
  'ur': 'ur',
  'fa': 'fa'
};

// Function to get language code from language name
export const getLanguageCode = (languageName) => {
  if (!languageName) return 'en';
  
  const normalized = languageName.toLowerCase().trim();
  return languageCodes[normalized] || 'en';
};