import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import FileUpload from './components/FileUpload';
import UnderLineViewer from './components/UnderLineViewer';
import Login from './components/Login';
import Register from './components/Register';
import SavedTranslations from './components/SavedTranslations';
import { setupArabicTTSListener } from './utils/arabicTTS';
import { speakWithAccent, speakAutoDetectAccent } from './utils/accentTTS';

// Point to Vercel Serverless Function
const N8N_WEBHOOK_URL = "/api/translate";

function App() {
  const [showViewer, setShowViewer] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'translate'

  // Auth state
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login', 'register', null
  const [showAuth, setShowAuth] = useState(false);
  const [showSavedTranslations, setShowSavedTranslations] = useState(false);
  const [translationsFilterMode, setTranslationsFilterMode] = useState('all'); // 'all' or 'terms'

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Setup Arabic TTS listener
  useEffect(() => {
    const cleanup = setupArabicTTSListener();
    
    // Setup accent-specific TTS listener
    const handleKeyDown = (e) => {
      // Listen for Ctrl+Shift+A to trigger accent-specific TTS
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
          // Get preferred accent from localStorage or default to en-US
          const preferredAccent = localStorage.getItem('preferredLanguage') || 'en-US';
          const langCode = preferredAccent.split('-')[0]; // Extract language code (e.g., 'en' from 'en-US')
          
          console.log('Accent-specific TTS triggered with accent:', preferredAccent, 'for text:', selectedText);
          speakWithAccent(selectedText, preferredAccent);
        } else {
          // If no text is selected, speak a welcome message with the selected accent
          const preferredAccent = localStorage.getItem('preferredLanguage') || 'en-US';
          speakWithAccent('Welcome to the UnderLine translation application.', preferredAccent);
        }
      }
      
      // Listen for Ctrl+Shift+D to trigger auto-detect accent TTS
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
          console.log('Auto-detect accent TTS triggered for text:', selectedText);
          speakAutoDetectAccent(selectedText);
        }
      }
    };

    // Add event listener for accent-specific TTS
    document.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
      cleanup();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setShowAuth(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowSavedTranslations(false);
  };

  const handleUploadSuccess = async (file, config) => {
    setIsLoading(true);
    setShowViewer(true);
    setError(null);
    setCurrentConfig(config);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetLang', config?.targetLang || 'Arabic');
      formData.append('splitMode', config?.splitMode || 'sentence');
      formData.append('groupSize', config?.linesPerGroup || '1');
      formData.append('isInsightMode', config?.isInsightMode || false);
      formData.append('insightCount', config?.insightCount || '20');
      formData.append('isKeyTermsMode', config?.isKeyTermsMode || false);
      formData.append('termCount', config?.termCount || '20');
      formData.append('translationType', config?.translationType || 'literal');
      formData.append('translationOnly', config?.translationOnly || false);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${response.status}`);
      }

      // Check if response is PDF
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translated_${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setIsLoading(false);
        alert('Translation complete! PDF downloaded successfully.');
        return;
      }

      // JSON Response
      const textResponse = await response.text();
      if (!textResponse || textResponse.trim() === "") {
        throw new Error("Connection successful, but server sent no data.");
      }

      const result = JSON.parse(textResponse);
      const data = Array.isArray(result) ? result[0] : result;

      // Use segments from backend if available for better accuracy
      let lines = [];
      if (data.segments && data.segments.length > 0) {
        lines = data.segments;
      } else {
        const DELIM = '<<<|||>>>';
        const tLines = (data.translated || "").split(DELIM).map(l => l.trim());
        const oLines = (data.original || "").split(DELIM).map(l => l.trim()).filter(l => l !== "");
        lines = oLines.map((originalText, i) => ({
          original: originalText,
          translation: tLines[i] && tLines[i] !== "" && !tLines[i].includes("[Error") ? tLines[i] : "Translation pending..."
        }));
      }

      setUploadedFile({ name: file.name, lines, config });
      setShowViewer(true);

      // Auto-save translation if user is logged in
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const saveRes = await fetch('http://localhost:3000/translations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              fileName: file.name,
              segments: lines,
              targetLang: config?.targetLang || 'Arabic',
              splitMode: config?.splitMode || 'sentence',
              isInsightMode: config?.isInsightMode || false,
              insightCount: config?.insightCount || '20',
              isKeyTermsMode: config?.isKeyTermsMode || false,
              termCount: config?.termCount || '20',
              translationOnly: config?.translationOnly || false
            })
          });

          if (saveRes.ok) {
            console.log('Translation auto-saved');
          } else {
            console.warn('Auto-save rejected by server:', saveRes.status);
          }
        } catch (saveErr) {
          console.warn('Auto-save failed:', saveErr);
        }
      }
    } catch (err) {
      console.error("Translation Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTranslation = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: uploadedFile.name,
          segments: uploadedFile.lines,
          targetLang: currentConfig?.targetLang || 'Arabic',
          splitMode: currentConfig?.splitMode || 'sentence',
          isKeyTermsMode: currentConfig?.isKeyTermsMode || false,
          isInsightMode: currentConfig?.isInsightMode || false,
          termCount: currentConfig?.termCount || '20',
          insightCount: currentConfig?.insightCount || '20',
          translationOnly: currentConfig?.translationOnly || false
        })
      });

      if (!response.ok) throw new Error('Failed to save');

      alert('Translation saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save translation. Please try again.');
    }
  };

  const handleViewSavedTranslation = (translation) => {
    setUploadedFile({
      name: translation.fileName,
      lines: translation.segments,
      config: { targetLang: translation.targetLang, splitMode: translation.splitMode }
    });
    setCurrentConfig({ targetLang: translation.targetLang, splitMode: translation.splitMode });
    setShowSavedTranslations(false);
    setShowViewer(true);
  };

  // Render auth screens
  if (showAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light">
        <Header
          user={user}
          onLogout={handleLogout}
          onShowAuth={() => setShowAuth(true)}
          onShowSaved={() => { setShowAuth(false); setShowSavedTranslations(true); }}
        />
        <main className="grow py-10">
          <div className="max-w-4xl mx-auto px-6 mb-6">
            <button
              onClick={() => setShowAuth(false)}
              className="text-gray-600 font-bold flex items-center hover:bg-gray-100 p-2 rounded-lg transition-all"
            >
              ← Back
            </button>
          </div>
          {authView === 'login' ? (
            <Login
              onLogin={handleLogin}
              onSwitchToRegister={() => setAuthView('register')}
            />
          ) : (
            <Register
              onRegister={handleLogin}
              onSwitchToLogin={() => setAuthView('login')}
            />
          )}
        </main>
      </div>
    );
  }

  // Render saved translations
  if (showSavedTranslations) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light">
        <Header
          user={user}
          onLogout={handleLogout}
          onShowAuth={() => { setShowSavedTranslations(false); setShowAuth(true); }}
          onShowSaved={() => setShowSavedTranslations(true)}
        />
        <main className="grow py-10">
          <SavedTranslations
            user={user}
            onViewTranslation={handleViewSavedTranslation}
            onBack={() => setShowSavedTranslations(false)}
            filterMode={translationsFilterMode}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background-light">
      <Header
        user={user}
        onLogout={handleLogout}
        onShowAuth={() => setShowAuth(true)}
        onShowSaved={() => { setTranslationsFilterMode('all'); setShowSavedTranslations(true); }}
      />
      <main className="grow py-10">
        {currentPage === 'home' && !showViewer ? (
          <Hero onStart={() => setCurrentPage('translate')} />
        ) : !showViewer ? (
          <div className="space-y-12">
            <div className="max-w-4xl mx-auto px-6 mb-2">
              <button
                onClick={() => setCurrentPage('home')}
                className="text-gray-400 font-bold flex items-center hover:text-primary transition-all text-sm mb-4"
              >
                ← Back Home
              </button>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="max-w-4xl mx-auto px-6 mb-6 flex justify-between items-center">
              <button
                onClick={() => { setShowViewer(false); setError(null); }}
                className="text-gray-600 font-bold flex items-center hover:bg-gray-100 p-2 rounded-lg transition-all"
              >
                ← Back to Upload
              </button>


            </div>
            <UnderLineViewer file={uploadedFile} isLoading={isLoading} error={error} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
