import React from 'react';
import { speakArabicText } from '../utils/arabicTTS';
import { translateWord, getLanguageCode } from '../utils/wordTranslator';
import { speakWithAccent } from '../utils/accentTTS';

const UnderLineViewer = ({ file, isLoading, error }) => {
    const displayLines = file?.lines || [];
    const [localLines, setLocalLines] = React.useState(displayLines.map(l => ({ ...l })));
    const [editingIndex, setEditingIndex] = React.useState(null);

    // Detect if we're in Insight Mode or Key Terms Mode
    const isInsightMode = file?.config?.isInsightMode === true || file?.config?.isInsightMode === 'true';
    const isKeyTermsMode = file?.config?.isKeyTermsMode === true || file?.config?.isKeyTermsMode === 'true';
    const translationOnly = file?.config?.translationOnly === true || file?.config?.translationOnly === 'true';
    const isInteractiveMode = file?.config?.isInteractiveMode === true || file?.config?.isInteractiveMode === 'true';
    const keyTerms = isKeyTermsMode ? (localLines || []) : [];

    const [activeWord, setActiveWord] = React.useState(null);
    const [wordTranslation, setWordTranslation] = React.useState('');
    const [isTranslatingWord, setIsTranslatingWord] = React.useState(false);
    const [selectedTargetLang, setSelectedTargetLang] = React.useState('en'); // Default to English
    const [translationCache, setTranslationCache] = React.useState(new Map()); // Cache for recent translations
    
    const translateActiveWord = async (word, targetLang) => {
        if (!word || !targetLang) return; // Allow single words, even if they contain spaces

        try {
            const result = await translateWord(word, targetLang);
            setWordTranslation(result);
            
            // Determine the appropriate speech language code based on the target language
            const speechLangMap = {
                'ar': 'ar-SA',
                'cs': 'cs-CZ',
                'de': 'de-DE',
                'en': 'en-US',
                'fr': 'fr-FR',
                'es': 'es-ES',
                'it': 'it-IT',
                'pt': 'pt-BR',
                'ru': 'ru-RU',
                'zh': 'zh-CN',
                'ja': 'ja-JP',
                'ko': 'ko-KR',
                'tr': 'tr-TR',
                'pl': 'pl-PL',
                'nl': 'nl-NL',
                'sv': 'sv-SE'
            };
            
            const speechCode = speechLangMap[targetLang] || 'en-US';
            await speakText(result, speechCode);
        } catch (e) {
            console.error('Translation error:', e);
            setWordTranslation('—');
        }
    };

    const renderInteractiveText = (text) => {
        if (!text) return null;
        
        // Split text into words but preserve punctuation and spacing
        const words = text.split(/(\s+)/).filter(part => part !== '');
        
        return words.map((part, i) => {
            if (part.trim() === '') {
                // If it's just whitespace, return it as-is
                return <span key={i}>{part}</span>;
            } else {
                // Clean the word to remove any punctuation for accurate translation
                const cleanWord = part.replace(/[.,!?;:"'()\[\]{}\-]/g, '');
                
                // If it's a word/token, wrap it with interactive functionality
                return (
                    <span 
                        key={i} 
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent event bubbling
                            // Only trigger if no text is selected (to avoid double trigger with handleMouseUp)
                            if (!window.getSelection().toString()) {
                                handleInteraction(cleanWord, true); // Pass clean word and flag for direct word click
                            }
                        }}
                        className="cursor-pointer hover:bg-amber-100 hover:text-amber-700 transition-colors px-1 rounded-md active:scale-95 inline-block"
                        title="Click to translate this word"
                    >
                        {part}
                    </span>
                );
            }
        });
    };

    // Optimized Voice Engine v4.0 - Accent-Specific Pronunciation
    const speakText = (text, langHint = 'en') => {
        return new Promise(async (resolve) => {
            try {
                if (!text) {
                    resolve();
                    return;
                }
    
                // Check if text contains Arabic characters and use dedicated Arabic TTS function
                if (/[؀-ۿ]/.test(text)) {
                    // Use the enhanced Arabic TTS function for Arabic text
                    await speakArabicText(text);
                    resolve();
                    return;
                }
                                
                // Enhanced language detection - try to auto-detect from text content
                let targetLangCode = 'en-US';
                                
                // If a specific language hint is provided, use it
                if (langHint && typeof langHint === 'string') {
                    const normalized = langHint.toLowerCase();
                                        
                    // Expanded Language Code Mapping
                    const codeMap = {
                        'arabic': 'ar-SA',
                        'czech': 'cs-CZ',
                        'french': 'fr-FR',
                        'german': 'de-DE',
                        'spanish': 'es-ES',
                        'italian': 'it-IT',
                        'english': 'en-US',
                        'chinese': 'zh-CN',
                        'russian': 'ru-RU',
                        'portuguese': 'pt-BR',
                        'japanese': 'ja-JP',
                        'korean': 'ko-KR',
                        'ar': 'ar-SA',
                        'cs': 'cs-CZ',
                        'en': 'en-US',
                        'fr': 'fr-FR',
                        'de': 'de-DE',
                        'es': 'es-ES',
                        'it': 'it-IT',
                        'zh': 'zh-CN',
                        'ru': 'ru-RU',
                        'pt': 'pt-BR',
                        'ja': 'ja-JP',
                        'ko': 'ko-KR'
                    };
                                        
                    targetLangCode = codeMap[normalized] || 'en-US';
                } else {
                    // Auto-detect from text content if no specific hint provided
                    if (/[؀-ۿ]/.test(text)) {
                        targetLangCode = 'ar-SA'; // Arabic
                    } else if (/[ĄąČčĎďĚěŇňŘřŠšŤťŮůŽžŕ]/.test(text)) {
                        targetLangCode = 'cs-CZ'; // Czech
                    } else if (/[一-鿿]/.test(text)) {
                        targetLangCode = 'zh-CN'; // Chinese
                    } else if (/[Ѐ-ӿ]/.test(text)) {
                        targetLangCode = 'ru-RU'; // Russian
                    } else if (/[぀-ゟ゠-ヿ]/.test(text)) {
                        targetLangCode = 'ja-JP'; // Japanese
                    } else if (/[가-힯]/.test(text)) {
                        targetLangCode = 'ko-KR'; // Korean
                    } else if (/[À-ÿ]/.test(text)) {
                        targetLangCode = 'fr-FR'; // French/Spanish/European
                    } else {
                        targetLangCode = 'en-US'; // Default to English
                    }
                }
    
                // Use the accent-specific TTS function
                console.log('🔊 Speaking with accent:', targetLangCode, 'for text:', text.substring(0, 30) + '...');
                await speakWithAccent(text, targetLangCode);
                    
                console.log('✅ Speech finished for:', text.substring(0, 30) + '...');
                resolve();
            } catch (e) {
                console.error('TTS Error:', e);
                resolve();
            }
        });
    };

    // Helper function to detect language from text content
    const detectLanguageFromText = (text) => {
        if (!text) return 'en';
            
        // Count characters from different scripts to determine dominant language
        const arabicChars = (text.match(/[؀-ۿ]/g) || []).length;
        const czechChars = (text.match(/[ĄąČčĎďĚěŇňŘřŠšŤťŮůŽžŕ]/g) || []).length;
        const cyrillicChars = (text.match(/[Ѐ-ӿ]/g) || []).length;
        const chineseChars = (text.match(/[一-鿿]/g) || []).length;
        const japaneseChars = (text.match(/[぀-ゟ゠-ヿ]/g) || []).length;
        const koreanChars = (text.match(/[가-힯]/g) || []).length;
            
        // Calculate percentages
        const totalLetters = (text.match(/[\w\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g) || []).length;
            
        if (totalLetters === 0) return 'en'; // If no letters, default to English
            
        const arabicPercent = (arabicChars / totalLetters) * 100;
        const czechPercent = (czechChars / totalLetters) * 100;
        const cyrillicPercent = (cyrillicChars / totalLetters) * 100;
        const chinesePercent = (chineseChars / totalLetters) * 100;
        const japanesePercent = (japaneseChars / totalLetters) * 100;
        const koreanPercent = (koreanChars / totalLetters) * 100;
            
        // Thresholds for detection
        const threshold = 20; // At least 20% of characters must be from a script to detect that language
            
        if (arabicPercent >= threshold) return 'ar';
        if (czechPercent >= threshold) return 'cs';
        if (cyrillicPercent >= threshold) return 'ru';
        if (chinesePercent >= threshold) return 'zh';
        if (japanesePercent >= threshold) return 'ja';
        if (koreanPercent >= threshold) return 'ko';
            
        // Fallback: if Arabic characters exist (even below threshold), prefer Arabic
        if (arabicChars > 0) return 'ar';
            
        // Default to English for Latin characters
        return 'en';
    };

    const handleInteraction = async (text, isDirectWordClick = false) => {
        const cleanText = text.trim();
        if (!cleanText || cleanText.length < 1) return; // Allow single characters now
    
        console.log('🖱️ MouseClicked Interaction:', cleanText);
            
        // Check cache first for immediate response
        const cacheKey = `${cleanText}_en`; // Always use English as default target
        if (translationCache.has(cacheKey)) {
            const cachedResult = translationCache.get(cacheKey);
            setActiveWord(cleanText);
            setWordTranslation(cachedResult.translation);
                
            // Play cached audio immediately
            const detectedLang = detectLanguageFromText(cleanText);
            speakText(cleanText, detectedLang);
                
            // Play translation audio after a short delay
            setTimeout(async () => {
                const targetCode = 'en'; // Always use English for selections
                const speechLangMap = {
                    'ar': 'ar-SA', 'cs': 'cs-CZ', 'de': 'de-DE', 'en': 'en-US',
                    'fr': 'fr-FR', 'es': 'es-ES', 'it': 'it-IT', 'pt': 'pt-BR',
                    'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
                    'tr': 'tr-TR', 'pl': 'pl-PL', 'nl': 'nl-NL', 'sv': 'sv-SE'
                };
                const speechCode = speechLangMap[targetCode] || 'en-US';
                await speakText(cachedResult.translation, speechCode);
            }, 600); // Increased delay for better separation
                
            return;
        }
    
        // Detect the language of the specific word
        const detectedLang = detectLanguageFromText(cleanText);
        console.log('🔤 Detected language:', detectedLang, 'for text:', cleanText);
    
        setActiveWord(cleanText);
        setWordTranslation('...');
        setIsTranslatingWord(true);
            
        try {
            // For direct word clicks, prioritize real-time translation for better accuracy
            if (isDirectWordClick) {
                console.log('🔄 Direct word click - using real-time translation for word:', cleanText);
                    
                // Always translate to English for selections
                const targetCode = 'en'; // Force English as target
                    
                console.log('🔄 Translating from', detectedLang, 'to', targetCode);
                    
                // Use the new word translation function for better accuracy
                const result = await translateWord(cleanText, targetCode);
                                        
                console.log('🌐 Word Translation Result:', result);
                setWordTranslation(result);
                    
                // Cache the result
                const newCache = new Map(translationCache);
                newCache.set(cacheKey, { translation: result, timestamp: Date.now() });
                    
                // Keep only last 50 translations to prevent memory issues
                if (newCache.size > 50) {
                    const oldestKey = newCache.keys().next().value;
                    newCache.delete(oldestKey);
                }
                    
                setTranslationCache(newCache);
                
                // Enhanced language detection for speech
                let detectedSourceForSpeech = detectedLang;
                // If Czech characters are detected in the original text, ensure we use Czech pronunciation
                if (cleanText.match(/[ČčĎďĚěŇňŘřŠšŤťŮůŽž]/)) {
                    detectedSourceForSpeech = 'cs';
                }
                                    
                // 1. Speak Original with DETECTED language (Fixes all-languages-read-as-English issue)
                await speakText(cleanText, detectedSourceForSpeech);
                
                // 2. Speak Translation with TARGET language AUTOMATICALLY (always English)
                await new Promise(resolve => setTimeout(resolve, 800)); // Longer pause for better separation
                if (result) {
                    // Determine the appropriate speech language code based on the target language
                    const speechLangMap = {
                        'ar': 'ar-SA', 'cs': 'cs-CZ', 'de': 'de-DE', 'en': 'en-US',
                        'fr': 'fr-FR', 'es': 'es-ES', 'it': 'it-IT', 'pt': 'pt-BR',
                        'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
                        'tr': 'tr-TR', 'pl': 'pl-PL', 'nl': 'nl-NL', 'sv': 'sv-SE'
                    };
                                    
                    const speechCode = speechLangMap[targetCode] || 'en-US';
                    await speakText(result, speechCode);
                }
            } else {
                // For selections (not direct clicks), use the original logic
                // First, try to find if this text exists in our pre-translated segments
                let preTranslated = null;
                let matchedLine = null;
                    
                if (localLines && localLines.length > 0) {
                    // Search for exact matches first (prioritize exact word matches over partial matches)
                    for (const line of localLines) {
                        // Check if the line contains the exact selected text as a separate word
                        const wordsInLine = line.original.split(/\W+/); // Split by non-word characters
                        if (wordsInLine.includes(cleanText)) {
                            preTranslated = line.translation || '';
                            matchedLine = line;
                            console.log('🎯 Found exact word match:', cleanText, 'in line:', line.original);
                            break;
                        }
                    }
                        
                    // If no exact word match found, try broader partial matches
                    if (!preTranslated || preTranslated === '') {
                        for (const line of localLines) {
                            if (line.original && line.original.includes(cleanText)) {
                                preTranslated = line.translation || '';
                                matchedLine = line;
                                console.log('🎯 Found partial match:', cleanText, 'in line:', line.original);
                                break;
                            }
                            if (line.translation && line.translation.includes(cleanText)) {
                                preTranslated = line.translation || '';
                                matchedLine = line;
                                break;
                            }
                        }
                    }
                        
                    // If still no match, try fuzzy matching
                    if (!preTranslated || preTranslated === '') {
                        const cleanTextLower = cleanText.toLowerCase();
                        for (const line of localLines) {
                            if (line.original && line.original.toLowerCase().includes(cleanTextLower)) {
                                preTranslated = line.translation || '';
                                matchedLine = line;
                                break;
                            }
                            if (line.translation && line.translation.toLowerCase().includes(cleanTextLower)) {
                                preTranslated = line.translation || '';
                                matchedLine = line;
                                break;
                            }
                        }
                    }
                }
    
                // If we have pre-translated content AND it's an exact match, use it
                // Otherwise, fall back to real-time translation for better word-level accuracy
                if (preTranslated && preTranslated !== '' && matchedLine && matchedLine.original.split(/\W+/).includes(cleanText)) {
                    console.log('🎯 Using exact word translation:', preTranslated);
                    setWordTranslation(preTranslated);
                        
                    // Cache the result
                    const newCache = new Map(translationCache);
                    newCache.set(cacheKey, { translation: preTranslated, timestamp: Date.now() });
                        
                    // Keep only last 50 translations
                    if (newCache.size > 50) {
                        const oldestKey = newCache.keys().next().value;
                        newCache.delete(oldestKey);
                    }
                        
                    setTranslationCache(newCache);
                        
                    // Speak original text with detected language
                    await speakText(cleanText, detectedLang);
                        
                    // Determine the target language code for speech
                    const targetCode = 'en'; // Always use English for selections
                    const speechLangMap = {
                        'ar': 'ar-SA', 'cs': 'cs-CZ', 'de': 'de-DE', 'en': 'en-US',
                        'fr': 'fr-FR', 'es': 'es-ES', 'it': 'it-IT', 'pt': 'pt-BR',
                        'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
                        'ar': 'ar-SA', 'cs': 'cs-CZ', 'en': 'en-US', 'fr': 'fr-FR',
                        'de': 'de-DE', 'es': 'es-ES', 'it': 'it-IT', 'zh': 'zh-CN',
                        'ru': 'ru-RU', 'pt': 'pt-BR', 'ja': 'ja-JP', 'ko': 'ko-KR'
                    };
                        
                    // Speak translation with target language AUTOMATICALLY (always English)
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const speechCode = speechLangMap[targetCode] || 'en-US';
                    if (preTranslated) await speakText(preTranslated, speechCode);
                } else {
                    // Always use real-time translation for Interactive Study mode for better word-level accuracy
                    console.log('🔄 Using real-time translation for word:', cleanText);
                        
                    // Always translate to English
                    const targetCode = 'en'; // Force English as target
                        
                    console.log('🔄 Translating from', detectedLang, 'to', targetCode);
                        
                    // Use the new word translation function for better accuracy
                    const result = await translateWord(cleanText, targetCode);
                                            
                    console.log('🌐 Word Translation Result:', result);
                    setWordTranslation(result);
                        
                    // Cache the result
                    const newCache = new Map(translationCache);
                    newCache.set(cacheKey, { translation: result, timestamp: Date.now() });
                        
                    // Keep only last 50 translations
                    if (newCache.size > 50) {
                        const oldestKey = newCache.keys().next().value;
                        newCache.delete(oldestKey);
                    }
                        
                    setTranslationCache(newCache);
                    
                    // Enhanced language detection for speech
                    let detectedSourceForSpeech = detectedLang;
                    // If Czech characters are detected in the original text, ensure we use Czech pronunciation
                    if (cleanText.match(/[ČčĎďĚěŇňŘřŠšŤťŮůŽž]/)) {
                        detectedSourceForSpeech = 'cs';
                    }
                                        
                    // 1. Speak Original with DETECTED language (Fixes all-languages-read-as-English issue)
                    await speakText(cleanText, detectedSourceForSpeech);
                    
                    // 2. Speak Translation with TARGET language AUTOMATICALLY (always English)
                    await new Promise(resolve => setTimeout(resolve, 800));
                    // Determine the appropriate speech language code based on the target language
                    const speechLangMap = {
                        'ar': 'ar-SA', 'cs': 'cs-CZ', 'de': 'de-DE', 'en': 'en-US',
                        'fr': 'fr-FR', 'es': 'es-ES', 'it': 'it-IT', 'pt': 'pt-BR',
                        'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
                        'tr': 'tr-TR', 'pl': 'pl-PL', 'nl': 'nl-NL', 'sv': 'sv-SE'
                    };
                                        
                    const speechCode = speechLangMap[targetCode] || 'en-US';
                    if (result) {
                        await speakText(result, speechCode);
                    }
                }
            }
                
        } catch (e) {
            console.error('❌ Interaction error:', e);
            setWordTranslation('Error');
        } finally {
            setIsTranslatingWord(false);
        }
    };

    const getSingleWordFromSelection = () => {
        const sel = window.getSelection();
        if (!sel || !sel.toString()) return null;

        // Get first word only
        const text = sel.toString().trim();
        const word = text.split(/\s+/)[0];

        // Clean symbols (keep only letters and numbers)
        return word.replace(/[^\p{L}\p{N}]/gu, '');
    };

    const handleMouseUp = () => {
        if (!isInteractiveMode) return;
        
        const word = getSingleWordFromSelection();
        
        if (!word) return;

        // Clear selection to avoid visual distraction
        window.getSelection().removeAllRanges();

        setActiveWord(word);
        
        // Detect language from the specific word
        const detectedLang = detectLanguageFromText(word);
        
        // Always translate to English for selections
        translateActiveWord(word, 'en');
    };

    React.useEffect(() => {
        setLocalLines((file?.lines || []).map(l => ({ ...l })));
    }, [file]);

    const updateTranslation = (index, newText) => {
        setLocalLines(prev => prev.map((line, i) =>
            i === index ? { ...line, translation: newText } : line
        ));
    };

    const handlePrint = async () => {
        if (!localLines || localLines.length === 0) return alert('No content to export');
        try {
            const original = localLines.map(l => l.original).join('<<<|||>>>');
            const translated = localLines.map(l => l.translation || '').join('<<<|||>>>');
            const segmentsJson = JSON.stringify(localLines);
            
            const resp = await fetch('http://localhost:5000/download-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    original, 
                    translated, 
                    segments: segmentsJson,
                    isLayoutPreserved: 'true',
                    translationOnly: file?.config?.translationOnly 
                })
            });
            if (!resp.ok) throw new Error('Server PDF failed');
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name || 'translated'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert('Error generating PDF from server');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-12">
            {/* Control Bar v2.0 */}
            <div className="glass premium-border rounded-[3.5rem] p-8 mb-16 flex flex-col lg:flex-row justify-between items-center gap-8 no-print animate-fade-in shadow-2xl bg-white/60">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center text-white shadow-lg animate-float">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-primary-dark tracking-tighter">{file?.name || 'Workspace'}</h2>
                        <div className="flex gap-3 items-center mt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">{displayLines.length} segments</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sync Status: Online</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handlePrint}
                    className="gradient-button px-14 py-6 rounded-4xl font-black shadow-2xl flex items-center gap-4 text-white group"
                >
                    <span className="text-xl">Export Document</span>
                    <svg className="w-6 h-6 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            </div>

            {isKeyTermsMode && keyTerms.length > 0 && (
                <div className="glass premium-border rounded-[3rem] p-8 mb-10 bg-white/70 shadow-xl animate-fade-in-up">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80">Terminology Extract</p>
                            <h3 className="text-2xl font-black text-primary-dark tracking-tight">Essential Terms ({keyTerms.length})</h3>
                            <p className="text-slate-500 text-sm mt-1">أهم المصطلحات المستخرجة من الـ PDF مع ترجمتها.</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-black text-xs uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            Live Extract
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keyTerms.map((term, idx) => (
                            <div key={idx} className="rounded-2xl border border-primary/10 bg-white/80 shadow-sm hover:shadow-lg transition-all p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Term {idx + 1}</span>
                                    <span className="text-[10px] font-black text-slate-400">⇄</span>
                                </div>
                                <div className="text-primary-dark font-black text-lg leading-tight mb-2" dir="auto">{term.original}</div>
                                <div className="text-slate-500 text-sm font-medium leading-snug" dir="auto">{term.translation}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-600 p-6 rounded-3xl mb-10 border border-red-100 flex items-center gap-4 animate-shake">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" /></svg>
                    </div>
                    <span className="font-black text-sm uppercase tracking-wider">{error}</span>
                </div>
            )}

            {/* Main Content v2.0 */}
            <div className="space-y-8 pb-32">
                {isInteractiveMode && activeWord && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-2xl border-2 border-amber-200 rounded-[3rem] p-10 shadow-2xl flex flex-col items-center min-w-[300px] animate-fade-in-up">
                        <div className="flex flex-col items-center text-center w-full">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mb-4">Interactive Study</span>
                            
                            {/* Language Direction Indicator */}
                            <div className="mb-3 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-2">
                                <span>🔤</span>
                                <span>{detectLanguageFromText(activeWord).toUpperCase()} → {(selectedTargetLang === 'auto' ? 'AUTO' : selectedTargetLang.toUpperCase())}</span>
                            </div>
                            
                            {/* Original Word (Top) */}
                            <h4 className="text-3xl font-black text-slate-800 tracking-tight mb-2 flex items-center gap-3">
                                {activeWord}
                                <button onClick={() => {
                                    // Speak the active word in its detected language
                                    speakText(activeWord, detectLanguageFromText(activeWord));
                                }} className="text-amber-500 hover:scale-110 transition-transform">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                                </button>
                            </h4>

                            {/* Divider Line */}
                            <div className="w-12 h-1 bg-amber-100 rounded-full my-4"></div>

                            {/* Translation Word (Bottom) */}
                            <p className="text-2xl font-bold text-primary flex items-center gap-3">
                                {wordTranslation}
                                <button onClick={() => {
                                    // Determine the target language code for translation speech
                                    let targetLangCode = 'en-US';
                                    if (file?.config?.targetLang) {
                                        const normalizedTarget = file.config.targetLang.toLowerCase();
                                        
                                        const speechLangMap = {
                                            'arabic': 'ar-SA',
                                            'czech': 'cs-CZ',
                                            'french': 'fr-FR',
                                            'german': 'de-DE',
                                            'spanish': 'es-ES',
                                            'italian': 'it-IT',
                                            'english': 'en-US',
                                            'chinese': 'zh-CN',
                                            'russian': 'ru-RU',
                                            'portuguese': 'pt-BR',
                                            'japanese': 'ja-JP',
                                            'korean': 'ko-KR',
                                            'ar': 'ar-SA',
                                            'cs': 'cs-CZ',
                                            'en': 'en-US',
                                            'fr': 'fr-FR',
                                            'de': 'de-DE',
                                            'es': 'es-ES',
                                            'it': 'it-IT',
                                            'zh': 'zh-CN',
                                            'ru': 'ru-RU',
                                            'pt': 'pt-BR',
                                            'ja': 'ja-JP',
                                            'ko': 'ko-KR'
                                        };
                                        
                                        targetLangCode = speechLangMap[normalizedTarget] || 'en-US';
                                    }
                                    speakText(wordTranslation, targetLangCode);
                                }} className="text-primary/60 hover:scale-110 transition-transform">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                                </button>
                            </p>
                            
                            {/* Language Selection for Word Translation */}
                            <div className="mt-6 w-full max-w-xs">
                                <select 
                                    value={selectedTargetLang}
                                    onChange={(e) => {
                                        const lang = e.target.value;
                                        setSelectedTargetLang(lang);
                                        if (activeWord && lang !== 'auto') {
                                            translateActiveWord(activeWord, lang);
                                        }
                                    }}
                                    className="w-full px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="auto">Auto Detect</option>
                                    <option value="cs">Czech</option>
                                    <option value="de">German</option>
                                    <option value="en">English</option>
                                    <option value="fr">French</option>
                                    <option value="es">Spanish</option>
                                    <option value="it">Italian</option>
                                    <option value="pt">Portuguese</option>
                                    <option value="ru">Russian</option>
                                    <option value="ja">Japanese</option>
                                    <option value="ko">Korean</option>
                                    <option value="zh">Chinese</option>
                                    <option value="ar">Arabic</option>
                                    <option value="pl">Polish</option>
                                    <option value="nl">Dutch</option>
                                    <option value="sv">Swedish</option>
                                    <option value="tr">Turkish</option>
                                </select>
                            </div>
                            
                            {/* Quick Language Buttons */}
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                <button 
                                    onClick={() => {
                                        setSelectedTargetLang('cs');
                                        translateActiveWord(activeWord, 'cs');
                                    }}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-200 transition-colors"
                                    title="Translate to Czech"
                                >
                                    CS
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedTargetLang('de');
                                        translateActiveWord(activeWord, 'de');
                                    }}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold hover:bg-red-200 transition-colors"
                                    title="Translate to German"
                                >
                                    DE
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedTargetLang('en');
                                        translateActiveWord(activeWord, 'en');
                                    }}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold hover:bg-green-200 transition-colors"
                                    title="Translate to English"
                                >
                                    EN
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedTargetLang('fr');
                                        translateActiveWord(activeWord, 'fr');
                                    }}
                                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold hover:bg-yellow-200 transition-colors"
                                    title="Translate to French"
                                >
                                    FR
                                </button>
                            </div>
                        </div>
                        
                        {/* Close Button */}
                        <button 
                            onClick={() => {
                                window.speechSynthesis.cancel();
                                setActiveWord(null);
                            }}
                            className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="glass premium-border rounded-[4rem] flex flex-col items-center justify-center py-40 gap-8 animate-pulse bg-white/30">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 border-8 border-primary/5 rounded-full"></div>
                            <div className="absolute inset-0 border-8 border-t-primary rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-3xl font-black text-primary-dark tracking-tighter mb-2">Analyzing Semantics</h3>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px]">Neural Network Mapping in Progress</p>
                        </div>
                    </div>
                ) : displayLines.length > 0 ? (
                    <div className="space-y-8">
                        {isInteractiveMode ? (
                            <div className="glass premium-border rounded-[3.5rem] p-10 sm:p-14 bg-white/60 shadow-xl animate-fade-in">
                                <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-6">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-black text-sm">✨</div>
                                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Interactive Study Workspace</span>
                                </div>
                                <div className="space-y-6" onMouseUp={handleMouseUp}>
                                    {localLines.map((line, index) => (
                                        <div key={index} className="leading-loose text-2xl font-medium text-slate-700 selection:bg-amber-200 relative group">
                                            {renderInteractiveText(line.original)}
                                            {/* Audio playback button for the whole line */}
                                            <button 
                                                onClick={() => {
                                                    // Determine the target language code for speech
                                                    let targetLangCode = 'en-US';
                                                    if (file?.config?.targetLang) {
                                                        const normalizedTarget = file.config.targetLang.toLowerCase();
                                                                                    
                                                        const speechLangMap = {
                                                            'arabic': 'ar-SA',
                                                            'czech': 'cs-CZ',
                                                            'french': 'fr-FR',
                                                            'german': 'de-DE',
                                                            'spanish': 'es-ES',
                                                            'italian': 'it-IT',
                                                            'english': 'en-US',
                                                            'chinese': 'zh-CN',
                                                            'russian': 'ru-RU',
                                                            'portuguese': 'pt-BR',
                                                            'japanese': 'ja-JP',
                                                            'korean': 'ko-KR',
                                                            'ar': 'ar-SA',
                                                            'cs': 'cs-CZ',
                                                            'en': 'en-US',
                                                            'fr': 'fr-FR',
                                                            'de': 'de-DE',
                                                            'es': 'es-ES',
                                                            'it': 'it-IT',
                                                            'zh': 'zh-CN',
                                                            'ru': 'ru-RU',
                                                            'pt': 'pt-BR',
                                                            'ja': 'ja-JP',
                                                            'ko': 'ko-KR'
                                                        };
                                                                                    
                                                        targetLangCode = speechLangMap[normalizedTarget] || 'en-US';
                                                    }
                                                    // Speak both original and translation
                                                    speakText(line.original, detectLanguageFromText(line.original));
                                                    setTimeout(() => {
                                                        if (line.translation) speakText(line.translation, targetLangCode);
                                                    }, 500);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-8 top-0 w-6 h-6 text-slate-500 hover:text-primary"
                                                title="Listen to this text"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Enhanced Interactive Features Panel */}
                                <div className="mt-10 pt-6 border-t border-slate-100">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                                            <div className="text-amber-600 font-black text-lg mb-2">💡 Tip</div>
                                            <p className="text-amber-700 text-sm">Click any word for instant translation and pronunciation</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                                            <div className="text-blue-600 font-black text-lg mb-2">🎯 Focus</div>
                                            <p className="text-blue-700 text-sm">Select multiple words to translate entire phrases</p>
                                        </div>
                                        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                                            <div className="text-green-600 font-black text-lg mb-2">🔊 Voice</div>
                                            <p className="text-green-700 text-sm">Hear pronunciations in the target language</p>
                                        </div>
                                        <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                                            <div className="text-purple-600 font-black text-lg mb-2">⌨️ Command</div>
                                            <p className="text-purple-700 text-sm">Ctrl+Shift+C for Arabic TTS, or select "عربي اكلم"</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : translationOnly ? (
                            <div className="glass premium-border rounded-[3.5rem] p-10 sm:p-14 bg-white/60 shadow-xl animate-fade-in">
                                <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-6">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black text-sm">AI</div>
                                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Continuous Translation Flow</span>
                                </div>
                                <div className="space-y-8">
                                    {localLines.map((line, index) => (
                                        <div 
                                            key={index}
                                            className={`text-primary-dark text-xl font-black leading-[2.2] ${line.translation?.length < 60 || /^\d+/.test(line.translation?.trim()) ? 'block my-10 border-l-4 border-primary/20 pl-6' : 'inline'}`}
                                            dir="auto"
                                        >
                                            {line.translation || '...'} 
                                            {line.translation?.length >= 60 && ' '}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            localLines.slice(0, (isInsightMode || isKeyTermsMode) ? localLines.length : 10).map((line, index) => (
                                <div
                                    key={index}
                                    className="group relative glass premium-border rounded-[3.5rem] overflow-hidden p-10 sm:p-14 transition-all duration-1000 hover:scale-[1.01] hover:shadow-2xl animate-fade-in-up"
                                    style={{ animationDelay: `${index * 150}ms` }}
                                >
                                    {/* Context Badge */}
                                    <div className="absolute top-0 right-0 px-10 py-4 bg-primary/5 border-b border-l border-primary/10 rounded-bl-4xl text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                        {isKeyTermsMode ? `Terminology ${index + 1}` : isInsightMode ? `Insight ${index + 1}` : `Unit ${index + 1}`}
                                    </div>

                                    <div className={`grid grid-cols-1 ${translationOnly ? '' : 'lg:grid-cols-2'} gap-16 lg:gap-24`}>
                                        {/* Source Column */}
                                        {!translationOnly && (
                                            <div className="space-y-5" onMouseUp={handleMouseUp}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-black text-xs">EN</div>
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Source Material</span>
                                                </div>
                                                <p className="text-slate-600 text-xl font-medium leading-[1.8] whitespace-pre-wrap selection:bg-amber-200 cursor-text" dir="auto">
                                                    {line.original}
                                                </p>
                                            </div>
                                        )}

                                        {/* Translation Column */}
                                        <div className={`space-y-5 ${translationOnly ? '' : 'lg:pl-20 border-t lg:border-t-0 lg:border-l border-slate-100 pt-10 lg:pt-0'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-black text-xs">AI</div>
                                                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">System Translation</span>
                                                </div>
                                                <button
                                                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                                                    className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline -mt-1 group-hover:translate-x-1 transition-transform"
                                                >
                                                    {editingIndex === index ? 'Done' : 'Refine'}
                                                </button>
                                            </div>

                                            {editingIndex === index ? (
                                                <textarea
                                                    value={line.translation || ''}
                                                    onChange={(e) => updateTranslation(index, e.target.value)}
                                                    onBlur={() => setEditingIndex(null)}
                                                    className="w-full text-primary-dark text-xl font-black leading-[1.8] p-6 rounded-3xl bg-slate-50 border-2 border-primary/30 outline-none focus:border-primary shadow-inner animate-fade-in"
                                                    rows={Math.max(3, (line.translation?.length || 0) / 40)}
                                                    dir="auto"
                                                    autoFocus
                                                />
                                            ) : (
                                                <p
                                                    className="text-primary-dark text-xl font-black leading-[1.8] cursor-text whitespace-pre-wrap"
                                                    dir="auto"
                                                    onClick={() => setEditingIndex(index)}
                                                >
                                                    {line.translation || <span className="text-slate-300 italic font-medium">Processing...</span>}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {localLines.length > 10 && !isInsightMode && (
                            <div className="glass premium-border rounded-[4rem] p-16 text-center animate-pulse-border no-print bg-white/40">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-3xl font-black text-primary-dark tracking-tighter mb-4">Preview Limit Reached</h3>
                                <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
                                    For optimized performance, we're displaying the first 10 core segments. <br />
                                    The complete <span className="text-primary font-black underline decoration-4 underline-offset-4">{localLines.length} units</span> are available in the high-fidelity PDF export.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass premium-border rounded-[5rem] p-32 text-center bg-white/20">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-float">
                            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Waiting for Input</h3>
                        <p className="text-slate-400 mt-4 font-medium">Your research workspace will activate once a file is processed.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnderLineViewer;
