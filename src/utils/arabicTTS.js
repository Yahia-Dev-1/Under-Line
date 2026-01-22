// Arabic TTS utility functions

// Function to speak Arabic text
export const speakArabicText = async (text) => {
  // First try the enhanced approach
  const result = await speakArabicTextEnhanced(text);
  
  // If that fails, try fallback approaches
  if (!result.success) {
    console.log('🔄 Trying fallback approaches...');
    
    // Fallback 1: Try with different Arabic language codes
    const fallbackCodes = ['ar-SA', 'ar-EG', 'ar-AE'];
    for (const code of fallbackCodes) {
      console.log(`🔄 Trying fallback with code: ${code}`);
      const fallbackResult = await speakArabicWithCode(text, code);
      if (fallbackResult.success) {
        console.log(`✅ Fallback successful with code: ${code}`);
        return;
      }
    }
    
    // Fallback 2: Try breaking text into smaller chunks
    if (text.length > 100) {
      console.log('🔄 Breaking text into chunks for better TTS handling');
      const chunks = text.match(/.{1,100}/g) || [text];
      for (const chunk of chunks) {
        await speakArabicTextEnhanced(chunk.trim());
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between chunks
      }
      return;
    }
    
    console.log('❌ All Arabic TTS approaches failed');
  }
};

// Enhanced Arabic TTS function
const speakArabicTextEnhanced = (text) => {
  return new Promise((resolve) => {
    try {
      if (!window.speechSynthesis || !text) {
        resolve();
        return;
      }

      // Stop current speech to avoid "drdsha"
      window.speechSynthesis.cancel();

      // Wait for voices to load
      let voices = window.speechSynthesis.getVoices() || [];
      
      // Chrome needs time to load voices
      if (voices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          voices = window.speechSynthesis.getVoices();
        });
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set Arabic language
      const targetLangCode = 'ar-SA';

      // Try to find best matching Arabic voice
      const arabicVoices = voices.filter(v => v.lang.toLowerCase().includes('ar'));
      
      // Log available Arabic voices for debugging
      console.log('🔍 Available Arabic voices:', arabicVoices.map(v => ({name: v.name, lang: v.lang})));
      
      const voice = arabicVoices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
                  || arabicVoices[0]
                  || voices.find(v => v.lang.toLowerCase().startsWith('ar'));

      if (voice) {
        utterance.voice = voice;
        utterance.lang = targetLangCode; // Force Arabic language code regardless of voice's reported language
        console.log('🔊 Speaking Arabic with voice:', voice.name, voice.lang, 'for text:', text.substring(0, 30) + '...');
        console.log('🎯 Using forced language code:', targetLangCode);
      } else {
        utterance.lang = targetLangCode;
        console.log('🔊 Speaking Arabic with default code:', targetLangCode, 'for text:', text.substring(0, 30) + '...');
        console.log('⚠️ No Arabic voice found, using default voice with Arabic language code');
      }

      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        console.log('✅ Arabic speech finished for:', text.substring(0, 30) + '...');
        resolve({success: true});
      };
      utterance.onerror = (e) => {
        console.error('❌ Arabic speech error:', e);
        console.error('Error details:', {
          error: e.error,
          charIndex: e.charIndex,
          elapsedTime: e.elapsedTime,
          name: e.name,
          message: e.message
        });
        // Try alternative approach if Arabic fails
        console.log('🔄 Attempting fallback approach for Arabic text');
        resolve({success: false, error: e});
      };

      console.log('🎤 Starting Arabic speech with lang code:', targetLangCode, 'for text:', text.substring(0, 50) + '...');
      console.log('📋 Utterance details:', {
        text: text.substring(0, 50) + '...',
        lang: utterance.lang,
        voice: voice ? voice.name : 'default',
        rate: utterance.rate,
        pitch: utterance.pitch
      });
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Arabic TTS Error:', e);
      resolve({success: false, error: e});
    }
  });
};

// Fallback function with specific language code
const speakArabicWithCode = (text, langCode) => {
  return new Promise((resolve) => {
    try {
      if (!window.speechSynthesis || !text) {
        resolve({success: false});
        return;
      }

      window.speechSynthesis.cancel();
      let voices = window.speechSynthesis.getVoices() || [];
      
      if (voices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          voices = window.speechSynthesis.getVoices();
        });
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        console.log(`✅ Fallback Arabic speech finished (${langCode}) for:`, text.substring(0, 30) + '...');
        resolve({success: true});
      };
      
      utterance.onerror = (e) => {
        console.error(`❌ Fallback Arabic speech error (${langCode}):`, e);
        resolve({success: false, error: e});
      };

      console.log(`🎤 Starting fallback Arabic speech with ${langCode} for:`, text.substring(0, 50) + '...');
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error(`Fallback Arabic TTS Error (${langCode}):`, e);
      resolve({success: false, error: e});
    }
  });
};

// Function to setup Arabic TTS listener
export const setupArabicTTSListener = () => {
  // Listen for the Arabic command "عربي اكلم"
  const handleKeyDown = (e) => {
    // Listen for Ctrl+Shift+C to trigger Arabic TTS command (stands for "Call" in Arabic)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText) {
        console.log('Arabic TTS triggered with selected text:', selectedText);
        speakArabicText(selectedText);
      } else {
        // If no text is selected, speak a welcome message
        speakArabicText('مرحباً بك في تطبيق الترجمة تحت السطر');
      }
      return;
    }
  };

  // Listen for mouseup to detect text selection
  const handleMouseUp = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      // Check if selected text matches the Arabic command
      if (selectedText === 'عربي اكلم') {
        // Clear the selection
        selection.removeAllRanges();
        
        // Speak a confirmation message
        speakArabicText('تم تنشيط خدمة النطق العربي');
      }
    }, 10); // Small delay to ensure selection is complete
  };

  // Add event listeners
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mouseup', handleMouseUp);
  };
};