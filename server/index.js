require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ArabicReshaper = require('arabic-persian-reshaper').ArabicReshaper;
const bidi = require('bidi-js')();
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');
const { PDFDocument: PDFLibDoc, rgb, degrees } = require('pdf-lib');
const fontkit = require('fontkit');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');


// --- CONFIG ---
const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;

// Serve Front-End Static Files
app.use(express.static(path.join(__dirname, "public")));

// Basic Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API works!", timestamp: new Date().toISOString() });
});

// Database file paths (simple JSON storage)
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TRANSLATIONS_FILE = path.join(DATA_DIR, 'translations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(TRANSLATIONS_FILE)) {
    fs.writeFileSync(TRANSLATIONS_FILE, JSON.stringify([]));
}

// Helper functions for data storage
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
const writeUsers = (users) => {
    const tempFile = USERS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(users, null, 2));
    fs.renameSync(tempFile, USERS_FILE);
};
const readTranslations = () => {
    try {
        const translations = JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf-8'));
        // Self-healing: Filter out oversized entries (> 500KB) which are likely corruption remnants
        const filtered = translations.filter(t => JSON.stringify(t).length < 500000);
        if (filtered.length !== translations.length) {
            console.warn(`Dropped ${translations.length - filtered.length} oversized/corrupted entries.`);
            // Write back clean data
            writeTranslations(filtered);
        }
        return filtered;
    } catch (e) {
        console.error('Error reading translations:', e.message);
        return [];
    }
};
const writeTranslations = (translations) => {
    const tempFile = TRANSLATIONS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(translations, null, 2));
    fs.renameSync(tempFile, TRANSLATIONS_FILE);
};

// Simple token generation
const generateToken = () => crypto.randomBytes(32).toString('hex');

// Hash password
const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let model = null;

if (API_KEY && API_KEY !== "YOUR_KEY_HERE") {
    genAI = new GoogleGenerativeAI(API_KEY);
    // Use gemini-1.5-flash which is the current stable model
    // Use gemini-2.0-flash which is the latest available model
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- AUTH MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Auth failed: No token provided');
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const users = readUsers();
    const user = users.find(u => u.token === token);

    if (!user) {
        console.warn('Auth failed: Invalid token');
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
};

// --- AUTH ENDPOINTS ---

// Register
app.post('/auth/register', (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const users = readUsers();

        // Check if email already exists
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const token = generateToken();
        const newUser = {
            id: crypto.randomUUID(),
            name,
            email,
            password: hashPassword(password),
            token,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeUsers(users);

        res.json({
            user: { id: newUser.id, name: newUser.name, email: newUser.email },
            token
        });
    } catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const users = readUsers();
        const user = users.find(u => u.email === email && u.password === hashPassword(password));

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate new token
        const token = generateToken();
        user.token = token;
        writeUsers(users);

        res.json({
            user: { id: user.id, name: user.name, email: user.email },
            token
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/auth/me', authMiddleware, (req, res) => {
    res.json({
        user: { id: req.user.id, name: req.user.name, email: req.user.email }
    });
});

// Logout
app.post('/auth/logout', authMiddleware, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (user) {
        user.token = null;
        writeUsers(users);
    }
    res.json({ success: true });
});

// --- TRANSLATIONS ENDPOINTS ---

// Save translation
app.post('/translations', authMiddleware, (req, res) => {
    try {
        const { fileName, segments, targetLang, splitMode, isKeyTermsMode, isInsightMode, termCount, insightCount } = req.body;

        const translations = readTranslations();
        const newTranslation = {
            id: crypto.randomUUID(),
            userId: req.user.id,
            fileName,
            segments,
            targetLang,
            splitMode,
            isKeyTermsMode: isKeyTermsMode === true || isKeyTermsMode === 'true' || false,
            isInsightMode: isInsightMode === true || isInsightMode === 'true' || false,
            termCount: termCount || null,
            insightCount: insightCount || null,
            createdAt: new Date().toISOString()
        };

        translations.push(newTranslation);
        writeTranslations(translations);

        res.json({ success: true, translation: newTranslation });
    } catch (e) {
        console.error('Save translation error:', e);
        res.status(500).json({ error: 'Failed to save translation' });
    }
});

// Get user's translations
app.get('/translations', authMiddleware, (req, res) => {
    try {
        const translations = readTranslations();
        const userTranslations = translations
            .filter(t => t.userId === req.user.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ translations: userTranslations });
    } catch (e) {
        console.error('Get translations error:', e);
        res.status(500).json({ error: 'Failed to fetch translations' });
    }
});

// Get single translation
app.get('/translations/:id', authMiddleware, (req, res) => {
    try {
        const translations = readTranslations();
        const translation = translations.find(t => t.id === req.params.id && t.userId === req.user.id);

        if (!translation) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        res.json({ translation });
    } catch (e) {
        console.error('Get translation error:', e);
        res.status(500).json({ error: 'Failed to fetch translation' });
    }
});

// Delete translation
app.delete('/translations/:id', authMiddleware, (req, res) => {
    try {
        const translations = readTranslations();
        const index = translations.findIndex(t => t.id === req.params.id && t.userId === req.user.id);

        if (index === -1) {
            return res.status(404).json({ error: 'Translation not found' });
        }

        translations.splice(index, 1);
        writeTranslations(translations);

        res.json({ success: true });
    } catch (e) {
        console.error('Delete translation error:', e);
        res.status(500).json({ error: 'Failed to delete translation' });
    }
});

// Language Mapping - comprehensive list matching all frontend options
const langMap = {
    // Main languages
    'Arabic (Standard)': 'ar',
    'Egyptian': 'ar',
    'Arabic (Colloquial)': 'ar',
    'Arabic (Egyptian)': 'ar',
    'Arabic': 'ar',
    'English': 'en',
    'German': 'de',
    'Spanish': 'es',
    'French': 'fr',
    'Italian': 'it',
    'Czech': 'cs',
    'Turkish': 'tr',
    'Chinese (Simplified)': 'zh-CN',
    'Chinese (Traditional)': 'zh-TW',
    'Chinese': 'zh',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Russian': 'ru',
    'Portuguese (Brazil)': 'pt-BR',
    'Portuguese (Portugal)': 'pt-PT',
    'Portuguese': 'pt',
    'Dutch': 'nl',
    'Hindi': 'hi',
    'Swedish': 'sv',
    'Norwegian': 'no',
    'Danish': 'da',
    'Finnish': 'fi',
    'Polish': 'pl',
    'Greek': 'el',
    'Hungarian': 'hu',
    'Romanian': 'ro',
    'Bulgarian': 'bg',
    'Thai': 'th',
    'Vietnamese': 'vi',
    'Indonesian': 'id',
    'Malay': 'ms',
    'Hebrew': 'he',
    'Ukrainian': 'uk',
    'Serbian': 'sr',
    'Slovak': 'sk',
    'Slovenian': 'sl',
    'Croatian': 'hr',
    'Filipino': 'tl',
    'Swahili': 'sw',
    'Persian (Farsi)': 'fa',
    'Persian': 'fa',
    'Farsi': 'fa',
    'Urdu': 'ur',
    'Bengali': 'bn',
    'Punjabi': 'pa',
    'Gujarati': 'gu',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Kannada': 'kn',
    'Malayalam': 'ml',
    'Marathi': 'mr',
    'Sinhalese': 'si',
    'Sinhala': 'si',
    'Nepali': 'ne',
    // Additional common languages
    'Afrikaans': 'af',
    'Albanian': 'sq',
    'Amharic': 'am',
    'Armenian': 'hy',
    'Azerbaijani': 'az',
    'Basque': 'eu',
    'Belarusian': 'be',
    'Bosnian': 'bs',
    'Catalan': 'ca',
    'Estonian': 'et',
    'Galician': 'gl',
    'Georgian': 'ka',
    'Haitian Creole': 'ht',
    'Icelandic': 'is',
    'Irish': 'ga',
    'Kazakh': 'kk',
    'Khmer': 'km',
    'Kurdish': 'ku',
    'Kyrgyz': 'ky',
    'Lao': 'lo',
    'Latin': 'la',
    'Latvian': 'lv',
    'Lithuanian': 'lt',
    'Luxembourgish': 'lb',
    'Macedonian': 'mk',
    'Malagasy': 'mg',
    'Maltese': 'mt',
    'Mongolian': 'mn',
    'Myanmar': 'my',
    'Burmese': 'my',
    'Pashto': 'ps',
    'Somali': 'so',
    'Sundanese': 'su',
    'Tajik': 'tg',
    'Tatar': 'tt',
    'Uzbek': 'uz',
    'Welsh': 'cy',
    'Xhosa': 'xh',
    'Yiddish': 'yi',
    'Yoruba': 'yo',
    'Zulu': 'zu',
    'Esperanto': 'eo'
};

// Fallback translation for when both Gemini and GTX fail
function getFallbackTranslation(text, targetLangOrCode) {
    // Simple heuristic to create a "translation" when all APIs fail
    // targetLangOrCode could be either a language name ("Arabic", "English") or a language code ("ar", "en")
    const targetLangLower = targetLangOrCode.toLowerCase();
    
    // Map language codes to full names for easier matching
    const codeToName = {
        'ar': 'arabic',
        'cs': 'czech',
        'fr': 'french',
        'de': 'german',
        'es': 'spanish',
        'ru': 'russian',
        'zh': 'chinese',
        'ja': 'japanese',
        'ko': 'korean',
        'pt': 'portuguese',
        'it': 'italian',
        'tr': 'turkish',
        'en': 'english'
    };
    
    // Get the normalized language name
    const langName = codeToName[targetLangLower] || targetLangLower;
    
    // For Arabic target
    if (langName.includes('arab') || targetLangOrCode === 'ar' || langName.includes('arabic')) {
        // If it's English text, provide a simple phonetic representation or return a placeholder
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            // For English text in Arabic target, provide a more helpful message
            return `[NEEDS ARABIC TRANSLATION: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            // If it's already Arabic text and target is Arabic, return as is
            // But if it's Arabic text and we expect a different language translation, return placeholder
            if (/[\u0600-\u06FF]/.test(text.trim())) {
                // Source is Arabic, target is Arabic, return as is
                return text;
            } else {
                // Return as is if no translation is possible
                return text;
            }
        }
    }
    // For Czech target
    else if (langName.includes('czech') || targetLangOrCode === 'cs') {
        // If it's English text, provide a simple placeholder
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[ČESKÝ_PŘEKLAD_POŽADOVÁN: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            // If it's already Czech text, return as is
            return text;
        }
    }
    // For French target
    else if (langName.includes('french') || targetLangOrCode === 'fr') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[TRADUCTION FRANÇAISE NÉCESSAIRE: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For German target
    else if (langName.includes('german') || targetLangOrCode === 'de') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[DEUTSCHE ÜBERSETZUNG BENÖTIGT: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Spanish target
    else if (langName.includes('spanish') || targetLangOrCode === 'es') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[TRADUCCIÓN ESPAÑOLA NECESARIA: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Russian target
    else if (langName.includes('russian') || targetLangOrCode === 'ru') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[ТРЕБУЕТСЯ РУССКИЙ ПЕРЕВОД: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Chinese target
    else if (langName.includes('chinese') || targetLangOrCode === 'zh') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[需要中文翻译: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Japanese target
    else if (langName.includes('japanese') || targetLangOrCode === 'ja') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[日本語翻訳が必要です: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Korean target
    else if (langName.includes('korean') || targetLangOrCode === 'ko') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[한국어 번역 필요: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Portuguese target
    else if (langName.includes('portuguese') || targetLangOrCode === 'pt') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[TRADUÇÃO PARA PORTUGUÊS NECESSÁRIA: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Italian target
    else if (langName.includes('italian') || targetLangOrCode === 'it') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[TRADUZIONE IN ITALIANO RICHIESTA: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For Turkish target
    else if (langName.includes('turkish') || targetLangOrCode === 'tr') {
        if (/^[A-Za-z\s\d\.,;:'"?!()]+$/.test(text.trim())) {
            return `[TÜRKÇE ÇEVİRİ GEREKLİ: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            return text;
        }
    }
    // For English target
    else if (langName.includes('english') || targetLangOrCode === 'en') {
        if (/^[\u0600-\u06FF\s\d\.,;:'"?!()]+/.test(text.trim())) {
            // If it's Arabic text and target is English, provide a more helpful message
            return `[ARABIC TEXT NEEDS ENGLISH TRANSLATION: ${text.substring(0, Math.min(30, text.length))}...]`;
        } else {
            // If it's already English text, return as is
            return text;
        }
    }
    // Special handling when we have Arabic text but want to translate to non-English languages
    else if (/[\u0600-\u06FF]/.test(text.trim())) {
        // We have Arabic text but the target language is not English
        // Provide appropriate placeholder in the target language
        if (langName.includes('arab') || targetLangOrCode === 'ar') {
            // If target is Arabic and source is Arabic, return as is
            return text;
        } else {
            // For other target languages, provide appropriate placeholder
            switch(targetLangOrCode.toLowerCase()) {
                case 'fr':
                case 'french':
                    return `[TRADUCTION NÉCESSAIRE: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'de':
                case 'german':
                    return `[ÜBERSETZUNG ERFORDERLICH: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'es':
                case 'spanish':
                    return `[TRADUCCIÓN NECESARIA: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'ru':
                case 'russian':
                    return `[ТРЕБУЕТСЯ ПЕРЕВОД: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'zh':
                case 'chinese':
                    return `[需要翻译: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'ja':
                case 'japanese':
                    return `[翻訳が必要です: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'ko':
                case 'korean':
                    return `[번역이 필요합니다: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'pt':
                case 'portuguese':
                    return `[TRADUÇÃO NECESSÁRIA: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'it':
                case 'italian':
                    return `[NECESSARIA TRADUZIONE: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'tr':
                case 'turkish':
                    return `[ÇEVİRİ GEREKİYOR: ${text.substring(0, Math.min(30, text.length))}...]`;
                case 'cs':
                case 'czech':
                    return `[POŽADOVÁN PŘEKLAD: ${text.substring(0, Math.min(30, text.length))}...]`;
                default:
                    // Generic placeholder
                    return `[TRANSLATION NEEDED: ${text.substring(0, Math.min(30, text.length))}...]`;
            }
        }
    }
    // For other language targets, return a generic placeholder
    else {
        return `[TRANSLATION_NEEDED: ${text.substring(0, Math.min(30, text.length))}...]`;
    }
}

// Levenshtein distance function for similarity detection
function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
        matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // insertion
                matrix[j - 1][i] + 1, // deletion
                matrix[j - 1][i - 1] + indicator // substitution
            );
        }
    }

    return matrix[str2.length][str1.length];
}

// Function to detect language from text content
function detectLanguageFromText(text) {
    // Czech characters detection
    if (text.match(/[\u010C\u010D\u010E\u010F\u011A\u011B\u0147\u0148\u0158\u0159\u0160\u0161\u0164\u0165\u016E\u016F\u017D\u017E]/)) {
        return 'cs'; // Czech
    }
    // Arabic characters
    if (text.match(/[\u0600-\u06FF]/)) {
        return 'ar';
    }
    // Chinese characters
    if (text.match(/[\u4E00-\u9FFF]/)) {
        return 'zh';
    }
    // Russian characters
    if (text.match(/[\u0400-\u04FF]/)) {
        return 'ru';
    }
    // Japanese characters (Hiragana, Katakana, Kanji)
    if (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/)) {
        return 'ja';
    }
    // Korean characters
    if (text.match(/[\uAC00-\uD7AF]/)) {
        return 'ko';
    }
    // Default to English for Latin characters
    return 'en';
}

// Function to get language code - handles custom languages
function getLanguageCode(langName) {
    if (!langName) return 'en';

    // First check the main language map
    if (langMap[langName]) return langMap[langName];

    // Check case-insensitive match
    const lowerLang = langName.toLowerCase();
    for (const [key, code] of Object.entries(langMap)) {
        if (key.toLowerCase() === lowerLang) return code;
    }

    // Handle Czech specifically
    if (lowerLang.includes('czech')) return 'cs';
    
    // Handle other common language patterns
    if (lowerLang.includes('arabic')) return 'ar';
    if (lowerLang.includes('english')) return 'en';
    if (lowerLang.includes('french')) return 'fr';
    if (lowerLang.includes('german')) return 'de';
    if (lowerLang.includes('spanish')) return 'es';
    if (lowerLang.includes('russian')) return 'ru';
    if (lowerLang.includes('chinese')) return 'zh';
    if (lowerLang.includes('japanese')) return 'ja';
    if (lowerLang.includes('korean')) return 'ko';
    if (lowerLang.includes('portuguese')) return 'pt';
    if (lowerLang.includes('italian')) return 'it';
    if (lowerLang.includes('turkish')) return 'tr';

    return 'en';
}

// Global delimiter to preserve per-segment boundaries across translation services
const DELIM = '<<<|||>>>';

// Helper to fix Arabic text for PDF (reshaping + BIDI + Numeral Conversion)
function fixArabicForPDF(text, convertNumerals = true, targetIsArabic = true) {
    if (!text) return '';

    let processedText = text;

    // Numeral Conversion
    if (convertNumerals) {
        const enNums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const arNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        
        const hasArabic = /[\u0600-\u06FF]/.test(text);
        
        if (hasArabic || targetIsArabic) {
            // Convert to Arabic Numerals (Eastern)
            enNums.forEach((num, i) => {
                processedText = processedText.replace(new RegExp(num, 'g'), arNums[i]);
            });
        } else {
            // Convert to English Numerals (Western)
            arNums.forEach((num, i) => {
                processedText = processedText.replace(new RegExp(num, 'g'), enNums[i]);
            });
        }
    }

    // Check if text contains Arabic characters before attempting reshaping
    const hasArabic = /[\u0600-\u06FF]/.test(processedText);
    if (!hasArabic) return processedText; // Return early if no Arabic characters

    // Only process Arabic text with reshaping functions
    try {
        const reshaped = ArabicReshaper.reshape(processedText);
        return bidi.getDisplay(reshaped);
    } catch (e) {
        console.error('Arabic fix error:', e);
        // If reshaping fails, return original text without Arabic processing
        return processedText;
    }
}


// Highly precise layout-preserving PDF generation
async function createLayoutPreservingPDF(originalPdfBuffer, translationSegments) {
    try {
        const pdfDoc = await PDFLibDoc.load(originalPdfBuffer);
        pdfDoc.registerFontkit(fontkit);
        
        let arabicFont = null;
        const tahomaPath = 'C:/Windows/Fonts/tahoma.ttf';
        if (fs.existsSync(tahomaPath)) {
            const fontBytes = fs.readFileSync(tahomaPath);
            arabicFont = await pdfDoc.embedFont(fontBytes, { subset: true });
        }

        // Load Logo for Watermark
        let logoImage = null;
        const logoPath = path.join(__dirname, '..', 'src', 'assets', 'WhatsApp Image 2026-01-19 at 11.34.45 AM.jpeg');
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        
        const typedArray = new Uint8Array(originalPdfBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;
        const pages = pdfDoc.getPages();
        
        let currentSegment = 0;
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const libPage = pages[i - 1];
            const { width, height } = libPage.getSize();

            // Add Logo Watermark
            if (logoImage) {
                const logoDims = logoImage.scale(0.12);
                libPage.drawImage(logoImage, {
                    x: width - logoDims.width - 20,
                    y: 20,
                    width: logoDims.width,
                    height: logoDims.height,
                    opacity: 0.2,
                });
            }
            
            const lines = {};
            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5] * 10) / 10;
                if (!lines[y]) lines[y] = [];
                lines[y].push(item);
            });
            
            const sortedY = Object.keys(lines).sort((a, b) => b - a);
            
            for (const y of sortedY) {
                if (currentSegment >= translationSegments.length) break;
                
                const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
                const segment = translationSegments[currentSegment];
                if (!segment || (!segment.translation && !segment.original)) continue;

                // Masking
                lineItems.forEach(item => {
                    libPage.drawRectangle({
                        x: item.transform[4] - 1,
                        y: item.transform[5] - 1,
                        width: item.width + 2,
                        height: item.transform[0] + 3,
                        color: rgb(1, 1, 1),
                    });
                });
                
                const firstItem = lineItems[0];
                const lastItem = lineItems[lineItems.length - 1];
                const originalFontSize = firstItem.transform[0];
                
                // Drastic font reduction as requested: 60% of original size
                const newFontSize = Math.max(2, originalFontSize * 0.6); 
                
                const targetText = segment.translation || '';
                if (!targetText) {
                    currentSegment++;
                    continue; // Skip if no translation
                }
                const isArabicTrans = /[\u0600-\u06FF]/.test(targetText);
                
                // Fix Arabic and convert numerals
                const translatedText = fixArabicForPDF(targetText, true, isArabicTrans);
                
                // Handling table of contents / index gaps
                // If the line has a large gap (e.g. title ... page number), 
                // but the translation is one block, we should try to span it properly
                // For now, we use the original X with a bit of padding
                let targetX = firstItem.transform[4];
                
                const margin = 50;
                try {
                    libPage.drawText(translatedText, {
                        x: isArabicTrans ? (width - margin - 20) : targetX, // Basic RTL alignment guess
                        y: firstItem.transform[5] + 1,
                        size: newFontSize,
                        font: arabicFont || pdfDoc.getForm().getDefaultFont(),
                        color: rgb(0, 0, 0),
                        maxWidth: width - targetX - 40, // Prevent horizontal overlap
                    });
                } catch (e) {
                    console.warn('Draw error:', e.message);
                }
                
                currentSegment++;
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (e) {
        console.error('PDF Error:', e);
        return null;
    }
}


// --- Helper Functions ---

function splitText(text, mode) {
    // Clean common OCR/artifact markers
    text = text.replace(/\r\n/g, '\n').trim();
    text = text.replace(/<<<\|\|\|>>>/g, ' ');
    text = text.replace(/>{2,}|<{2,}|\|{2,}/g, ' ');

    console.log(`\n📋 Processing with Semantic Split Mode: "${mode}"`);

    // Helper to get sentences (meaning units)
    const getSentencesFromText = (input) => {
        // First, handle common abbreviations that contain periods but don't end sentences
        let processed = input
            .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Co|Corp|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.\s/gi, (match) => {
                return match.replace('.', 'DOTPLACEHOLDER');
            })
            .replace(/\b[a-zA-Z]\.\s/g, (match) => {
                return match.replace('.', 'DOTPLACEHOLDER');
            });
            
        // Split by sentence endings, but preserve the punctuation
        const sentences = processed
            .split(/([.!?؟](?:\s+|$))/)
            .reduce((acc, curr, i) => {
                if (i % 2 === 0) {
                    if (curr.trim()) acc.push(curr);
                } else if (acc.length > 0) {
                    acc[acc.length - 1] += curr;
                }
                return acc;
            }, [])
            .map(s => s
                .replace(/DOTPLACEHOLDER/g, '.') // Restore the periods in abbreviations
                .trim()
            )
            .filter(s => s.length > 0 && !/^\d+$/.test(s) && s.length > 2); // Filter out very short segments
            
        // Further refine by checking if segments are truly complete thoughts
        const refined = [];
        let currentSegment = '';
        
        for (const sentence of sentences) {
            currentSegment += sentence;
            
            // If this segment is reasonably sized (not too short), add it
            if (currentSegment.length > 100) {
                refined.push(currentSegment.trim());
                currentSegment = '';
            } else if (/[.!?؟]\s*$/.test(sentence)) {
                // If the sentence ends with punctuation and is reasonably long, add it
                if (currentSegment.length > 20) {
                    refined.push(currentSegment.trim());
                    currentSegment = '';
                }
            }
        }
        
        // Add remaining segment if it's substantial
        if (currentSegment.trim() && currentSegment.length > 5) {
            refined.push(currentSegment.trim());
        }
        
        return refined;
    };

    // ========== WORD MODE ==========
    if (mode === 'word') {
        const rawWords = text
            .split(/\s+/)
            .filter(w => w.length > 0 && !/^\d+$/.test(w));

        console.log(`📊 WORD mode: Initially found ${rawWords.length} words`);

        // Connectors that should be joined with the next word for better meaning
        const connectors = new Set([
            'in', 'on', 'at', 'by', 'for', 'with', 'the', 'a', 'an', 'to', 'of', 'from', 'as', 'onto', 'into', 'upon', 'around', 'above', 'below',
            'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك'
        ]);

        const merged = [];
        for (let i = 0; i < rawWords.length; i++) {
            let current = rawWords[i];
            const lower = current.toLowerCase().replace(/[.,!?;:()]/g, '');

            // If it's a connector and not the last word, join it with the next
            if (connectors.has(lower) && i < rawWords.length - 1) {
                // Check if the next word is ALSO a connector (e.g., "in the")
                let next = rawWords[i + 1];
                let nextLower = next.toLowerCase().replace(/[.,!?;:()]/g, '');

                if (connectors.has(nextLower) && i < rawWords.length - 2) {
                    // Triple join! (e.g., "in the stadium")
                    merged.push(`${current} ${next} ${rawWords[i + 2]}`);
                    i += 2;
                } else {
                    // Double join (e.g., "the stadium")
                    merged.push(`${current} ${next}`);
                    i += 1;
                }
            } else {
                merged.push(current);
            }
        }

        console.log(`📊 WORD mode: Semantically merged into ${merged.length} segments`);
        return merged;
    }

    // ========== PARAGRAPH MODE ==========
    if (mode === 'paragraph') {
        // More sophisticated paragraph detection
        // Split by multiple criteria: double newlines, or single newlines that appear to separate paragraphs
        let paragraphs = [];
        
        // First try to split by double newlines (traditional paragraph breaks)
        const initialSplit = text.split(/\n\s*\n+/);
        
        for (const chunk of initialSplit) {
            // For each chunk, check if it might contain multiple paragraphs separated by single newlines
            // but where the newlines indicate paragraph breaks (e.g., when following sentence-ending punctuation)
            const subChunks = chunk.split('\n');
            
            let currentPara = '';
            for (const line of subChunks) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // Check if this line likely starts a new paragraph
                // If it looks like a continuation of current paragraph, append to it
                if (currentPara === '') {
                    currentPara = trimmedLine;
                } else {
                    // Check if the previous line ends with sentence-ending punctuation
                    // or if the current line starts with a capital letter (indicating new sentence/paragraph)
                    const prevEndsWithPunct = /[.!?؟]$/.test(currentPara.trim());
                    const currStartsWithCap = /^[A-Z\u0621-\u064A\u0660-\u0669]/.test(trimmedLine);
                    
                    if (prevEndsWithPunct || currStartsWithCap) {
                        // Likely a new paragraph
                        paragraphs.push(currentPara);
                        currentPara = trimmedLine;
                    } else {
                        // Likely a continuation
                        currentPara += ' ' + trimmedLine;
                    }
                }
            }
            
            if (currentPara.trim()) {
                paragraphs.push(currentPara);
            }
        }
        
        // Final cleaning and filtering
        paragraphs = paragraphs
            .map(p => p.replace(/\s+/g, ' ').trim())
            .filter(p => p.length > 0 && !/^\d+$/.test(p));
        
        console.log(`📊 PARAGRAPH mode: Found ${paragraphs.length} real paragraphs`);
        return paragraphs;
    }

    // ========== LINE MODE ==========
    if (mode === 'line') {
        const lines = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !/^\d+$/.test(l));
        console.log(`📊 LINE mode: Found ${lines.length} literal lines`);
        return lines;
    }

    // DEFAULT: Semantic sentence split with intelligent grouping
    const semanticUnits = getSentencesFromText(text.replace(/\n+/g, ' '));
    console.log(`📊 SEMANTIC mode: Found ${semanticUnits.length} meaning-based units`);
    return semanticUnits;
}

// Simple fallback key-terms extractor (frequency-based) when AI model is unavailable
function generateFallbackKeyTerms(text, limit = 20) {
    if (!text) return [];

    const stopwords = new Set([
        // English
        'the','and','for','with','that','this','from','into','onto','upon','above','below','about','after','before','between','among','within','without','over','under','again','further','then','once','here','there','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','can','will','just','don','should','now',
        'a','an','of','to','in','on','at','by','as','is','are','was','were','be','been','being','it','its','if','or','but','their','they','them','he','she','his','her','you','your','we','our','us',
        // Arabic (basic)
        'في','من','على','عن','مع','إلى','الى','هذا','هذه','ذلك','تلك','التي','الذي','الذين','اللواتي','اللاتي','ما','متى','أين','أو','و','ثم','كما','لكن','بل','قد','كان','كانت','يكون','يكونون','هو','هي','هم','هن','أنا','نحن','أن','إن','إذا','قد','كل','أي','أيضا','أو'
    ]);

    // Normalize text: remove punctuation, digits, and collapse spaces
    const cleaned = text
        .replace(/[0-9]/g, ' ')
        .replace(/[.,;:!?()[\\]{}"“”'’«»<>\/\\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    if (!cleaned) return [];

    const freq = new Map();
    for (const token of cleaned.split(' ')) {
        if (!token || token.length < 3) continue;
        if (stopwords.has(token)) continue;
        freq.set(token, (freq.get(token) || 0) + 1);
    }

    const sorted = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(1, parseInt(limit, 10) || 20))
        .map(([word]) => ({ original: word, translation: word }));

    return sorted;
}

async function translateWithGTX(segments, targetCode, targetLang = 'English') {
    const results = [];

    for (const s of segments) {
        try {
            // First try Google Translate API
            const r = await axios.get(
                'https://translate.googleapis.com/translate_a/single',
                {
                    params: {
                        client: 'gtx',
                        sl: 'auto',  // Auto-detect source language
                        tl: targetCode,
                        dt: 't',
                        q: s
                    },
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': '*/*',
                        'Referer': 'https://translate.google.com/'
                    },
                    timeout: 10000 // 10 second timeout
                }
            );
            let text = r.data && r.data[0] ? r.data[0].map(i => i ? i[0] : '').filter(Boolean).join('') : '';
            
            // Check if the translation is just the original text (copy detection)
            if (!text || text.trim() === s.trim()) {
                console.log('⚠️ GTX returned original text, trying alternative...');
                
                // Try with explicit source language detection
                try {
                    const detectResp = await axios.get(
                        'https://translate.googleapis.com/translate_a/single',
                        {
                            params: {
                                client: 'gtx',
                                sl: 'auto',
                                tl: targetCode,
                                dt: 't',
                                dj: '1',  // Get detailed response
                                q: s
                            },
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': '*/*',
                                'Referer': 'https://translate.google.com/'
                            },
                            timeout: 10000 // 10 second timeout
                        }
                    );
                    
                    const detectedSource = detectResp.data && detectResp.data.src ? detectResp.data.src : null;
                    if (detectedSource && detectedSource !== targetCode) {
                        const altResp = await axios.get(
                            'https://translate.googleapis.com/translate_a/single',
                            {
                                params: {
                                    client: 'gtx',
                                    sl: detectedSource,
                                    tl: targetCode,
                                    dt: 't',
                                    q: s
                                },
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                    'Accept': '*/*',
                                    'Referer': 'https://translate.google.com/'
                                },
                                timeout: 10000 // 10 second timeout
                            }
                        );
                        text = altResp.data && altResp.data[0] ? altResp.data[0].map(i => i ? i[0] : '').filter(Boolean).join('') : '';
                    }
                } catch (detectError) {
                    console.log('Detection request failed:', detectError.message);
                }
            }
            
            // If still no good translation, use fallback
            if (!text || text.trim() === s.trim()) {
                console.log('❌ GTX failed to translate segment:', s.substring(0, 50) + '...');
                results.push(getFallbackTranslation(s, targetLang));
            } else {
                results.push(text || s);
            }
        } catch (error) {
            console.error('GTX Error for segment:', s.substring(0, 50) + '...', error.message);
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                // Network-related errors - try with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                try {
                    // Retry the request
                    const r = await axios.get(
                        'https://translate.googleapis.com/translate_a/single',
                        {
                            params: {
                                client: 'gtx',
                                sl: 'auto',
                                tl: targetCode,
                                dt: 't',
                                q: s
                            },
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': '*/*',
                                'Referer': 'https://translate.google.com/'
                            },
                            timeout: 15000 // 15 second timeout for retry
                        }
                    );
                    let text = r.data && r.data[0] ? r.data[0].map(i => i ? i[0] : '').filter(Boolean).join('') : '';
                    
                    if (!text || text.trim() === s.trim()) {
                        results.push(getFallbackTranslation(s, targetLang)); // Use targetLang for fallback
                    } else {
                        results.push(text || s);
                    }
                } catch (retryError) {
                    console.error('GTX Retry failed for segment:', s.substring(0, 50) + '...', retryError.message);
                    // On error, use fallback translation instead of error marker
                    results.push(getFallbackTranslation(s, targetLang)); // Use targetLang for fallback
                }
            } else {
                // On error, use fallback translation instead of error marker
                results.push(getFallbackTranslation(s, targetLang)); // Use targetLang for fallback
            }
        }
    }
    return results;
}

async function translateWithGeminiStrict(segments, targetLang) {
    if (!model) return null;

    const SEP = '<<<SEG>>>';
    
    // Determine dialect-specific instructions
    let dialectInstructions = "";
    if (targetLang && targetLang.includes('Standard')) {
        dialectInstructions = `
- SPECIFIC DIALECT: Use MODERN STANDARD ARABIC (Fusha).
- ACADEMIC PRECISION: Use formal, sophisticated vocabulary. Pay extreme attention to I'rab (إعراب) and high-level syntax.`;
    } else if (targetLang && (targetLang.includes('Egyptian') || targetLang.includes('Colloquial'))) {
        dialectInstructions = `
- SPECIFIC DIALECT: Use EGYPTIAN COLLOQUIAL (اللغة العامية المصرية).
- NATURAL FLOW: Adapt the phrasing to sound like a native Egyptian professional while maintaining the core meaning.`;
    }

    const prompt = `
You are an ELITE ACADEMIC AND PROFESSIONAL HUMAN TRANSLATOR with expertise in cultural adaptation and contextual meaning.

TARGET LANGUAGE: ${targetLang}
TARGET LANGUAGE CODE: ${getLanguageCode(targetLang)}
SOURCE LANGUAGE DETECTION: ${detectLanguageFromText(segments.join(' '))}

${dialectInstructions}

CRITICAL QUALITY STANDARDS:
- STRICT LANGUAGE OUTPUT: You MUST translate ALL text into ${targetLang}. DO NOT leave any text in the original language.
- MEANING-FIRST: Do NOT translate word-for-word. Capture the essence, context, and intended meaning of the text with intelligent adaptation.
- NATIVE PHRASING: The output must read as if it were originally written in ${targetLang} by a native speaker, using natural expressions and idioms.
- ACADEMIC INTEGRITY: Maintain professional tone, consistent terminology, and high-level linguistic flow while preserving the original meaning.
- BROKEN TEXT FIX: If the input has broken phrasing, fix it in the translation to be coherent and professionally structured.
- CONTEXTUAL ADAPTATION: Adapt cultural references, units of measurement, and expressions appropriately for the target audience.
- INTELLIGENT SEGMENTATION: Understand that segments may be parts of larger contexts; maintain coherence across segments.
- FORMATTING: DO NOT merge or split segments. KEEP EXACT ORDER AND COUNT.
- NO extra text, NO explanations.
- NEVER copy the original text as-is. Always translate with intelligent adaptation.
- ABSOLUTELY FORBIDDEN: If the original text is in English, you must NEVER return English text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Czech, you must NEVER return Czech text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in French, you must NEVER return French text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in German, you must NEVER return German text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Spanish, you must NEVER return Spanish text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Russian, you must NEVER return Russian text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Chinese, you must NEVER return Chinese text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Japanese, you must NEVER return Japanese text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Korean, you must NEVER return Korean text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Portuguese, you must NEVER return Portuguese text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Italian, you must NEVER return Italian text. You must ALWAYS translate to ${targetLang}.
- ABSOLUTELY FORBIDDEN: If the original text is in Turkish, you must NEVER return Turkish text. You must ALWAYS translate to ${targetLang}.
- If you cannot translate a specific technical term, transliterate it to ${targetLang} script or use the closest equivalent in ${targetLang}.

INPUT:
${segments.join(SEP)}

OUTPUT:
(Exactly ${segments.length} segments in ${targetLang}, separated by ${SEP})
`;

    try {
        const result = await model.generateContent(prompt);
        let out = result.response.text().trim().split(SEP).map(s => s.trim());

        // Self-healing
        while (out.length < segments.length) out.push('');
        if (out.length > segments.length) out = out.slice(0, segments.length);
        
        // Final validation: ensure translations are different from originals
        for (let i = 0; i < out.length; i++) {
            if (out[i] && out[i].trim() === segments[i].trim()) {
                console.log('⚠️ Gemini returned original text, using GTX fallback for segment:', segments[i].substring(0, 50) + '...');
                // Use GTX as fallback for this specific segment
                try {
                    const gtxResult = await translateWithGTX([segments[i]], getLanguageCode(targetLang), targetLang);
                    if (gtxResult && gtxResult[0] && gtxResult[0].trim() !== segments[i].trim()) {
                        out[i] = gtxResult[0];
                    } else {
                        out[i] = getFallbackTranslation(segments[i], targetLang);
                    }
                } catch (fallbackError) {
                    console.error('GTX fallback failed:', fallbackError.message);
                    out[i] = getFallbackTranslation(segments[i], targetLang);
                }
            }
        }

        return out;
    } catch (e) {
        console.error("Gemini Strict Error:", e.message);
        return null;
    }
}

async function extractTopInsights(text, count, targetLang) {
    if (!model) return null;

    const prompt = `You are a high-level research analyst and linguistic expert.
Your task is to analyze the following text and extract EXACTLY the top ${count} most important, insightful, or famous sentences that represent the core essence of the document.

TEXT TO ANALYZE:
${text.substring(0, 100000)} 

INSTRUCTIONS:
1. Identify the ${count} most significant sentences.
2. For each sentence, provide the original text and its professional translation into ${targetLang}.
3. The translation must be accurate, contextually relevant, and linguistically precise.
4. Return the results in a JSON array format where each object has "original" and "translation" keys.

OUTPUT FORMAT (JSON ONLY):
[
  { "original": "...", "translation": "..." },
  ...
]

Do NOT provide any commentary, notes, or extra text. Return ONLY the JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text().trim();

        // Clean JSON formatting
        if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1];
            if (jsonText.startsWith('json')) jsonText = jsonText.substring(4);
            jsonText = jsonText.split('```')[0]; // Ensure we close it
        }

        const insights = JSON.parse(jsonText.trim());
        return Array.isArray(insights) ? insights : null;
    } catch (e) {
        console.error("Extraction Error:", e.message);
        return null;
    }

}

async function extractKeyTerms(text, targetLang) {
    if (!model) return null;

    const prompt = `You are a specialized terminology expert.
Your task is to analyze the following text and extract ALL the significant technical terms, keywords, or specialized vocabulary that are crucial for understanding the document.

TEXT TO ANALYZE:
${text.substring(0, 100000)} 

INSTRUCTIONS:
1. Analyze the text to identify key terms. Do not limit yourself to a specific number; extract as many as serve the document's context (e.g., 5-10 for short texts, 20-50+ for long/dense texts).
2. Look for:
   - Technical jargon (medical, engineering, scientific, etc.)
   - Proper nouns of significance
   - Repeated specialized concepts
   - Acronyms defined in the text
3. For each term, provide the original text and its accurate translation/definition into ${targetLang}.
4. Return the results in a JSON array format where each object has "original" and "translation" keys.

OUTPUT FORMAT (JSON ONLY):
[
  { "original": "...", "translation": "..." },
  ...
]

Do NOT provide any commentary. Return ONLY the JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text().trim();

        if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1];
            if (jsonText.startsWith('json')) jsonText = jsonText.substring(4);
            jsonText = jsonText.split('```')[0];
        }

        const terms = JSON.parse(jsonText.trim());
        return Array.isArray(terms) ? terms : null;
    } catch (e) {
        console.error("Key Term Extraction Error:", e.message);
        return null;
    }
}


// --- Main Endpoint ---

app.post('/translate', upload.single('file'), async (req, res) => {
    try {
        // process.stdout.write('\x1Bc'); // Removed clear command

        console.log("⚡ New Job: " + (req.file ? req.file.originalname : "Unknown"));

        if (!req.file) return res.status(400).json({ error: "No file" });

        const { targetLang, splitMode, isInsightMode, insightCount, isKeyTermsMode } = req.body; // Added isKeyTermsMode here
        const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_KEY_HERE";

        // Parse text based on file type
        let rawText = '';
        const fileName = req.file.originalname.toLowerCase();

        if (req.file.mimetype === 'application/pdf' || fileName.endsWith('.pdf')) {
            // Use pdfjs-dist for consistent line detection across translation and export
            const typedArray = new Uint8Array(req.file.buffer);
            const loadingTask = pdfjsLib.getDocument({ data: typedArray });
            const pdfDoc = await loadingTask.promise;
            
            rawText = '';
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                
                // Group by Y to maintain layout lines
                const lines = {};
                textContent.items.forEach(item => {
                    const y = Math.round(item.transform[5] * 10) / 10;
                    if (!lines[y]) lines[y] = [];
                    lines[y].push(item);
                });
                
                const sortedY = Object.keys(lines).sort((a, b) => b - a);
                sortedY.forEach(y => {
                    const lineText = lines[y].sort((a, b) => a.transform[4] - b.transform[4])
                        .map(item => item.str).join(' ').trim();
                    if (lineText) rawText += lineText + '\n';
                });
            }
            rawText = rawText.trim();
            req.originalPdfBuffer = req.file.buffer;
        } else if (fileName.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            rawText = result.value;
        } else if (fileName.endsWith('.xlsx')) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            let excelText = [];
            workbook.eachSheet(sheet => {
                sheet.eachRow(row => {
                    row.eachCell(cell => {
                        if (cell.value) excelText.push(cell.value.toString());
                    });
                });
            });
            rawText = excelText.join('\n');
        } else {
            // Assume it's a text file (txt, md, csv, etc.)
            rawText = req.file.buffer.toString('utf-8');
        }

        if (!rawText || !rawText.trim()) return res.status(400).json({ error: "Empty file (or unreadable format)" });

        // Use EXACTLY what user selected - no overriding
        const effectiveMode = splitMode || 'sentence';
        console.log(`\n🎯 User selected split mode: "${effectiveMode}" (Insight Mode: ${isInsightMode})`);

        // --- NEW: INSIGHT & KEY TERMS EXTRACTION MODES ---
        if (isInsightMode === 'true' || isInsightMode === true) {
            console.log(`🔍 Extracting Top ${insightCount || 20} Insights...`);
            const insights = await extractTopInsights(rawText, parseInt(insightCount || '20'), targetLang);

            if (insights) {
                return res.json([{
                    sys_version: "AI_v2_Insights",
                    original: insights.map(p => p.original).join(DELIM),
                    translated: insights.map(p => p.translation).join(DELIM),
                    segments: insights,
                    mode: 'insights'
                }]);
            } else {
                console.warn("Insight extraction failed or API key not configured, falling back to normal translation.");
            }
        } else if (isKeyTermsMode === 'true' || isKeyTermsMode === true) {
            // NEW: Key Terms Extraction (Auto-Detect)
            console.log(`🔑 Extracting All Relevant Key Terms (Auto-Detect)...`);
            let terms = await extractKeyTerms(rawText, targetLang);

            if (!terms || terms.length === 0) {
                console.warn("Key term extraction failed or API key not configured, using fallback frequency-based extractor.");
                terms = generateFallbackKeyTerms(rawText, parseInt(req.body.termCount || '20', 10) || 20);
            }

            if (terms) {
                return res.json([{
                    sys_version: "AI_v2_Terms",
                    original: terms.map(p => p.original).join(DELIM),
                    translated: terms.map(p => p.translation).join(DELIM),
                    segments: terms,
                    mode: 'terms'
                }]);
            } else {
                console.warn("Key term extraction failed or API key not configured, falling back to normal translation.");
            }
        }

        // Split text according to user's choice
        const parts = splitText(rawText, effectiveMode);

        // Get groupSize from user selection (1, 2, 3, 5, 10)
        const groupSize = parseInt(req.body.groupSize || req.body.linesPerGroup || '1', 10) || 1;
        console.log(`📦 Group Size: ${groupSize}`);

        // Group parts according to user's batch size selection (Strict Adherence)
        let groupedParts = [];
        let i = 0;

        while (i < parts.length) {
            let chunk = [];
            let currentBatchCount = 0;

            // Strict batch gathering - Use single newline to keep them as "lines"
            while (currentBatchCount < groupSize && i < parts.length) {
                chunk.push(parts[i]);
                currentBatchCount++;
                i++;
            }

            groupedParts.push(chunk.join('\n'));
        }
        console.log(`📊 Split: ${parts.length} ${effectiveMode}s -> Grouped into ${groupedParts.length} segments (batch size: ${groupSize})`);

        let translatedParts = [];
        const batchSize = hasKey ? 10 : 15; // Increased batch size for speed
        const targetCode = getLanguageCode(targetLang);
        console.log(`🌐 Target Language: "${targetLang}" -> Code: "${targetCode}"`);

        // Reduce batch size to prevent memory issues
        const reducedBatchSize = hasKey ? 5 : 10; // Reduced from 10/15 to 5/10
        
        for (let i = 0; i < groupedParts.length; i += reducedBatchSize) {
            const batch = groupedParts.slice(i, i + reducedBatchSize);
            let translations = null;

            if (hasKey) {
                process.stdout.write(`\r🚀 AI Batch ${Math.ceil(i / reducedBatchSize) + 1}... `);
                try {
                    translations = await translateWithGeminiStrict(batch, targetLang);
                } catch (geminiError) {
                    console.log(`❌ Gemini failed: ${geminiError.message}, falling back to GTX`);
                    translations = null; // Ensure we use GTX fallback
                }
            }
            
            if (!translations || translations.every(t => !t || t.trim() === "")) {
                process.stdout.write(`\r🌍 GTX Batch ${Math.ceil(i / reducedBatchSize) + 1}... `);
                try {
                    translations = await translateWithGTX(batch, targetCode, targetLang);
                } catch (gtxError) {
                    console.log(`❌ GTX failed: ${gtxError.message}`);
                    // Create fallback translations for each segment in the batch
                    translations = batch.map(segment => getFallbackTranslation(segment, targetLang));
                }
            }

            // Process batch results
            for (let idx = 0; idx < batch.length; idx++) {
                let t = translations && translations[idx] ? translations[idx] : "";
                
                // Check if translation actually happened (not just copied)
                const originalText = batch[idx].trim();
                const translatedText = t ? t.trim() : "";
                
                // Enhanced copy detection: check for similarity and language
                const isExactCopy = translatedText === originalText;
                const isSimilar = originalText && translatedText && 
                    levenshteinDistance(originalText.toLowerCase(), translatedText.toLowerCase()) < Math.min(originalText.length, translatedText.length) * 0.1; // Less than 10% difference
                
                const isCopied = isExactCopy || isSimilar;
                
                // Better detection for failed translations
                const isPlaceholder = t && (t.includes('[TRANSLATION NEEDED:') || t.includes('[ENGLISH TRANSLATION NEEDED:') || t.includes('[الترجمة العربية مطلوبة:') || t.includes('[TRANSLATION_NEEDED:'));
                
                const needsRetry = !t || t.trim() === "" || t.includes('[Error]') || t === '...' || t.includes('[TRANSLATION_FAILED]') || isCopied || isPlaceholder;
                
                if (needsRetry) {
                    try {
                        // Fallback to GTX single if translation failed
                        // Add delay to respect rate limits
                        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay between retries
                        const single = await translateWithGTX([batch[idx]], targetCode, targetLang);
                        
                        // Check if the single translation is still problematic
                        const singleText = single && single[0] ? single[0] : '';
                        const isSingleExactCopy = singleText.trim() === originalText.trim();
                        const isSingleSimilar = originalText && singleText && 
                            levenshteinDistance(originalText.toLowerCase(), singleText.toLowerCase()) < Math.min(originalText.length, singleText.length) * 0.1;
                        
                        if (single && single[0] && !isSingleExactCopy && !isSingleSimilar && !single[0].includes('[TRANSLATION_FAILED]') && !single[0].includes('[TRANSLATION NEEDED:')) {
                            t = single[0];
                        } else {
                            // Use fallback translation when both Gemini and GTX fail
                            console.log('Using fallback translation for:', batch[idx].substring(0, 50) + '...');
                            t = getFallbackTranslation(batch[idx], targetLang);
                        }
                    } catch (e) {
                        console.warn('Retry single failed', e.message);
                        // Use fallback if everything else fails
                        t = getFallbackTranslation(batch[idx], targetLang);
                    }
                }
                
                // Final check to ensure we don't save the original text as translation
                if (!t || t.trim() === originalText.trim() || t.includes('[TRANSLATION NEEDED:') || t.includes('[ENGLISH TRANSLATION NEEDED:') || t.includes('[ARABIC TEXT NEEDS ENGLISH TRANSLATION:') || t.includes('[NEEDS ARABIC TRANSLATION:')) {
                    console.log('⚠️ Translation identical to original or placeholder, using fallback for:', batch[idx].substring(0, 50) + '...');
                    t = getFallbackTranslation(batch[idx], targetLang);
                }
                
                translatedParts.push({ original: batch[idx], translation: t || "" });
            }
            // Add a small delay between batches to prevent overwhelming the system and allow garbage collection
            await new Promise(r => setTimeout(r, 300));
        }

        console.log("\n✅ Done.");
        console.log(`📦 Returning ${translatedParts.length} segments`);

        // Log first few segments for debugging
        translatedParts.slice(0, 3).forEach((p, i) => {
            console.log(`  [${i}] Original: "${p.original.substring(0, 50)}..."`);
            console.log(`  [${i}] Translation: "${(p.translation || '').substring(0, 50)}..."`);
        });

        // Return Array with segments for full state recovery
        res.json([{
            sys_version: hasKey ? "AI_v2" : "GTX_v2",
            original: translatedParts.map(p => p.original).join(DELIM),
            translated: translatedParts.map(p => p.translation).join(DELIM),
            segments: translatedParts,
            mode: effectiveMode,
            targetLang: targetLang // Ensure frontend receives the intended target language
        }]);

    } catch (e) {
        console.error("Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// New: Server-side PDF Generation (2-Column Layout)
app.post('/download-pdf', upload.single('file'), async (req, res) => {
    try {
        const { original, translated, segments, mode, isLayoutPreserved, translationOnly } = req.body;
        const translationSegments = segments ? JSON.parse(segments) : [];
        const isTranslationOnly = translationOnly === true || translationOnly === 'true';

        // If layout preservation is requested and we have a PDF file
        if (isLayoutPreserved === 'true' && req.file && (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf'))) {
            const pdfBuffer = await createLayoutPreservingPDF(req.file.buffer, translationSegments);
            if (pdfBuffer) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=translated_layout.pdf');
                return res.send(pdfBuffer);
            }
        }

        // Fallback to original 2-column PDF generation if layout preservation fails or isn't requested
        const chunks = [];
        const doc = new PDFDocument({ margin: 50 });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            if (chunks.length === 0) {
                console.error('PDF generation yielded no data');
                if (!res.headersSent) {
                    return res.status(500).json({ error: "PDF generation failed: No data" });
                }
            }
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=translated.pdf');
            res.send(result);
        });

        // Enhanced font loading with better Arabic support
        const fontsToTry = [
            'C:/Windows/Fonts/tahoma.ttf',           // Standard Arabic-supporting font
            'C:/Windows/Fonts/calibri.ttf',         // Calibri for better readability
            'C:/Windows/Fonts/segoeui.ttf',         // Segoe UI for modern look
            'C:/Windows/Fonts/arial.ttf',           // Arial as fallback
            'C:/Windows/Fonts/georgia.ttf',         // Georgia for better serif
            'C:/Windows/Fonts/verdana.ttf'          // Verdana for readability
        ];
        
        let fontLoaded = false;
        
        for (const fontPath of fontsToTry) {
            if (fs.existsSync(fontPath)) {
                try {
                    const fontName = path.basename(fontPath, path.extname(fontPath));
                    doc.registerFont(fontName, fontPath);
                    doc.font(fontName);
                    fontLoaded = true;
                    console.log(`✅ Loaded font: ${fontName}`);
                    break;
                } catch (e) {
                    console.error(`❌ Font load fail ${fontPath}:`, e.message);
                }
            }
        }

        if (!fontLoaded) {
            console.warn('No system fonts found, falling back to basic');
            try { doc.font('Helvetica'); } catch (e) { }
        }

        // Title
        doc.fontSize(26).fillColor('#1D4ED8').text('UnderLine Translation', { align: 'center' });
        doc.moveDown(1.5);

        const oLines = original ? original.split(DELIM) : [];
        const tLines = translated ? translated.split(DELIM) : [];

        for (let i = 0; i < Math.max(oLines.length, tLines.length); i++) {
            const orig = (oLines[i] || '').trim();
            const trans = (tLines[i] || '').trim();

            if (!orig && !trans) continue;

            // Page break if near bottom
            if (doc.y > 700) doc.addPage();

            // 1. Original Text (Only if NOT Translation Only)
            if (orig && !isTranslationOnly) {
                const isArabicOrig = /[؀-ۿ]/.test(orig);
                // Use larger font size for better readability
                doc.fillColor('#4B5563')
                    .fontSize(isArabicOrig ? 18 : 22) // Slightly smaller for Arabic to accommodate complex characters
                    .text(fixArabicForPDF(orig, true, isArabicOrig), {
                        align: isArabicOrig ? 'right' : 'left',
                        lineGap: 3,
                        features: isArabicOrig ? ['rtla'] : [],
                        // Better layout options for Arabic text
                        characterSpacing: isArabicOrig ? 0.5 : 0
                    });
                doc.moveDown(0.5);
            }

            // 2. Translated Text
            if (trans) {
                const isArabic = /[\u0600-\u06FF]/.test(trans);
                // Check if it's Czech text
                const isCzech = /[\u010C\u010D\u010E\u010F\u011A\u011B\u0147\u0148\u0158\u0159\u0160\u0161\u0164\u0165\u016E\u016F\u017D\u017E]/.test(trans);
                // Check if it's a number or a very short line (likely heading)
                const isNumber = /^\d+/.test(trans.trim()) || /^[٠-٩]+/.test(trans.trim());
                const isShort = trans.length < 60 || isNumber;
                            
                doc.fillColor('#000000')
                    .fontSize(isArabic ? 16 : 18) // Slightly smaller font for Arabic to accommodate complex characters
                    .text(fixArabicForPDF(trans, true, isArabic), {
                        align: isArabic ? 'right' : 'left',
                        lineGap: isTranslationOnly ? 8 : 4, // Generous line spacing for readability
                        features: isArabic ? ['rtla'] : [],
                        characterSpacing: isArabic ? 0.5 : 0 // Better spacing for Arabic text
                    });
                
                // Optimized spacing for "Translation Only" mode
                if (isTranslationOnly) {
                    if (isShort) {
                        doc.moveDown(1.8); // Large gap for numbers/headings to separate sections
                    } else {
                        doc.moveDown(1.2); // Comfortable gap between normal paragraphs
                    }
                } else {
                    doc.moveDown(0.5);
                }
            }

            // Divider (Only if NOT Translation Only)
            if (!isTranslationOnly) {
                doc.moveDown(1.2);
                doc.strokeColor('#E5E7EB')
                    .lineWidth(1)
                    .moveTo(50, doc.y)
                    .lineTo(doc.page.width - 50, doc.y)
                    .stroke();
                doc.moveDown(1.5);
            }
        }

        doc.end();
    } catch (e) {
        console.error("PDF Generate Error:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate PDF: " + e.message });
        }
    }
});

app.listen(PORT, () => {

    const hasKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_KEY_HERE";
    console.log(`
    🚀 Backend Ready!
    -----------------
    Url: http://localhost:${PORT}
    AI:  ${hasKey ? "ACTIVE (Gemini 1.5 Flash) 🔥" : "INACTIVE (Using Google GTX) ⚠️"}
    ${!hasKey ? "-> Add your API Key in server/.env to unlock smart translation!" : ""}
    `);
});
