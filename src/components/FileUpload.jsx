import React, { useState, useRef } from 'react';

const FileUpload = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetLang, setTargetLang] = useState('Arabic');
  const [customLang, setCustomLang] = useState('');
  const [useCustomLang, setUseCustomLang] = useState(false);
  const [linesPerGroup, setLinesPerGroup] = useState('3');
  const [splitMode, setSplitMode] = useState('sentence');
  // Insights mode removed as per user request
  const [isKeyTermsMode, setIsKeyTermsMode] = useState(false);
  const [translationOnly, setTranslationOnly] = useState(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [termCount, setTermCount] = useState('20');
  const [showBatchSize, setShowBatchSize] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleConfirm = () => {
    if (selectedFile && onUploadSuccess) {
      const finalLang = useCustomLang && customLang.trim() ? customLang.trim() : targetLang;
      onUploadSuccess(selectedFile, {
        targetLang: finalLang,
        linesPerGroup,
        splitMode,
        isInsightMode: false, // Feature disabled
        insightCount: '0',
        isKeyTermsMode,
        isInteractiveMode,
        termCount,
        translationOnly
      });
    } else if (!selectedFile) {
      alert("Please select a file first!");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Setup Your Project</h2>
        <p className="text-slate-600 font-bold text-lg">Configure your professional translation workspace in seconds.</p>
      </div>

      {/* Upload Area - Full Width on Desktop */}
      <div className="mb-12">
        <div
          onClick={triggerFileInput}
          className={`
            relative group overflow-hidden
            bg-blue-500 rounded-[4rem] p-16
            text-center transition-all duration-700
            border-[3px] border-solid cursor-pointer
            ${isDragging || selectedFile ? 'border-primary bg-primary/5 shadow-2xl' : 'border-slate-300 hover:border-primary'}
            hover:scale-[1.01] hover:shadow-xl
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) setSelectedFile(file);
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.txt,.docx"
          />

          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`
                w-32 h-32 rounded-[3.5rem]
                flex items-center justify-center mb-10
                transition-all duration-700 shadow-inner
                ${selectedFile
                  ? 'bg-primary text-white scale-110 shadow-[0_20px_50px_rgba(59,130,246,0.5)]'
                  : 'bg-blue-700 text-white group-hover:scale-110 group-hover:shadow-[0_20px_50px_rgba(59,130,246,0.5)]'
                }
              `}
            >
              {selectedFile ? (
                <svg className="w-16 h-16 animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>

            <h3 className="text-3xl font-black text-slate-900 mb-4">
              {selectedFile ? selectedFile.name : "Target File"}
            </h3>
            <p className="text-slate-100 font-bold max-w-xs mx-auto">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready to sync`
                : "Drop your clinical or academic source here"}
            </p>
          </div>

          {selectedFile && <div className="absolute bottom-0 left-0 h-2 bg-primary animate-shimmer" style={{ width: '100%' }}></div>}
        </div>
      </div>

      {/* Settings Grid - Below Upload Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Target Language</h4>
          </div>

          <div className="bg-slate-100/50 p-2 rounded-4xl flex relative border border-slate-200 shadow-inner">
            <div className={`absolute top-2 bottom-2 w-[calc(50%-8px)] bg-white rounded-2xl shadow-sm transition-all duration-500 ease-out ${useCustomLang ? 'left-[calc(50%+4px)]' : 'left-2'}`}></div>
            <button onClick={() => setUseCustomLang(false)} className={`flex-1 py-4 font-black text-xs transition-all relative z-10 ${!useCustomLang ? 'text-primary' : 'text-slate-400'}`}>CURATED</button>
            <button onClick={() => setUseCustomLang(true)} className={`flex-1 py-4 font-black text-xs transition-all relative z-10 ${useCustomLang ? 'text-primary' : 'text-slate-400'}`}>CUSTOM</button>
          </div>

          {!useCustomLang ? (
            <div className="relative animate-fade-in group">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full p-8 bg-blue-100 premium-border rounded-[2.5rem] outline-none font-black text-slate-900 text-2xl shadow-xl transition-all cursor-pointer appearance-none group-hover:border-primary/40 border-4 border-sky-500 border-solid"
              >
                <option>Arabic</option>
                <option>Chinese (Simplified)</option>
                <option>Chinese (Traditional)</option>
                <option>Czech</option>
                <option>Danish</option>
                <option>Dutch</option>
                <option>English</option>
                <option>Finnish</option>
                <option>French</option>
                <option>German</option>
                <option>Greek</option>
                <option>Hebrew</option>
                <option>Hindi</option>
                <option>Hungarian</option>
                <option>Indonesian</option>
                <option>Italian</option>
                <option>Japanese</option>
                <option>Korean</option>
                <option>Malay</option>
                <option>Norwegian</option>
                <option>Polish</option>
                <option>Portuguese</option>
                <option>Romanian</option>
                <option>Russian</option>
                <option>Spanish</option>
                <option>Swedish</option>
                <option>Thai</option>
                <option>Turkish</option>
                <option>Vietnamese</option>

              </select>
              <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={customLang}
              onChange={(e) => setCustomLang(e.target.value)}
              placeholder="Type language..."
              className="w-full p-8 bg-white premium-border rounded-[2.5rem] outline-none font-black text-slate-900 text-2xl shadow-xl animate-fade-in"
            />
          )}
        </div>

        <div className="space-y-12">
          {/* Analysis Mode Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-8 bg-primary rounded-full"></span>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Analysis Mode</h4>
            </div>

            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'paragraph', label: 'PARAGRAPH', icon: '📝' },
                  { id: 'line', label: 'SENTENCE', icon: '⚡' },
                  { id: 'word', label: 'WORD', icon: '🔍' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      disabled={translationOnly}
                      onClick={() => {
                        setSplitMode(mode.id);
                        setShowBatchSize(mode.id !== 'paragraph');
                        if (mode.id === 'word') setLinesPerGroup('5');
                      }}
                      className={`
                          flex flex-col items-center justify-center py-8 px-2 rounded-3xl transition-all 
                          ${translationOnly ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                          ${splitMode === mode.id && !translationOnly
                          ? 'bg-primary text-white shadow-2xl scale-105'
                          : 'bg-white text-slate-400 border border-slate-100 hover:border-primary/20 hover:text-primary'}
                        `}
                    >
                      <span className="text-3xl mb-3">{mode.icon}</span>
                      <span className="text-[10px] font-black tracking-widest">{mode.label}</span>
                    </button>
                  ))}
              </div>

              {showBatchSize && (
                <div className="bg-slate-50 p-6 rounded-3xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-400 tracking-widest">BATCH QUANTITY</span>
                    <span className="text-primary font-black">{linesPerGroup} {splitMode}s</span>
                  </div>
                  <input
                    type="range" min="1" max={splitMode === 'word' ? '50' : '10'}
                    value={linesPerGroup}
                    onChange={(e) => setLinesPerGroup(e.target.value)}
                    className="w-full h-3 bg-blue-300 rounded-lg appearance-none cursor-pointer accent-primary shadow-inner"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Output Style Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Output Style</h4>
            </div>

            <div 
              onClick={() => {
                const newState = !translationOnly;
                setTranslationOnly(newState);
                if (newState) {
                  setSplitMode('sentence'); // Use sentence split for better translation stability
                  setShowBatchSize(false);
                  setIsInteractiveMode(false); // Exclusive
                }
              }}
              className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm flex items-center justify-between cursor-pointer transition-all group
                ${translationOnly ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200'}`}
            >
              <div className="flex flex-col">
                <span className={`text-lg font-black tracking-tight transition-colors ${translationOnly ? 'text-indigo-600' : 'text-slate-900'}`}>Translation Only</span>
                <span className="text-xs font-bold text-slate-400">Natural continuous flow (Auto-optimized splitting)</span>
              </div>
              <div
                className={`
                  w-16 h-8 rounded-full transition-all duration-500 relative
                  ${translationOnly ? 'bg-amber-600' : 'bg-sky-700'}
                `}
              >
                <div className={`
                  absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500
                  ${translationOnly ? 'left-9' : 'left-1'}
                `}></div>
              </div>
            </div>

            {/* NEW: Interactive Study Mode */}
            <div 
              onClick={() => {
                const newState = !isInteractiveMode;
                setIsInteractiveMode(newState);
                if (newState) {
                  setTranslationOnly(false); // Exclusive
                  setSplitMode('line'); // Line split is best for original text interaction
                  setShowBatchSize(false);
                }
              }}
              className={`bg-white p-6 rounded-[2.5rem] border-2 shadow-sm flex items-center justify-between cursor-pointer transition-all group
                ${isInteractiveMode ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 hover:border-amber-200'}`}
            >
              <div className="flex flex-col">
                <span className={`text-lg font-black tracking-tight transition-colors ${isInteractiveMode ? 'text-amber-600' : 'text-slate-900'}`}>Interactive Study</span>
                <span className="text-xs font-bold text-slate-400">Click words to translate & hear pronunciation</span>
              </div>
              <div
                className={`
                  w-16 h-8 rounded-full transition-all duration-500 relative
                  ${isInteractiveMode ? 'bg-amber-600' : 'bg-sky-700'}
                `}
              >
                <div className={`
                  absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500
                  ${isInteractiveMode ? 'left-9' : 'left-1'}
                `}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Initialize Engine Button - Full Width Below Grid */}
      <div className="mt-12 pt-12 border-t border-slate-100 text-center max-w-2xl mx-auto">
        <button
          onClick={handleConfirm}
          disabled={!selectedFile}
          className={`
              w-full gradient-button py-8 rounded-[3rem] font-black text-2xl shadow-2xl 
              ${!selectedFile ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-[1.02]'}
            `}
        >
          <span className="flex items-center justify-center gap-4">
            Initialize Engine
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </span>
        </button>
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => <div key={i} className={`w-8 h-8 rounded-full border-2 border-white bg-slate-${i + 1}00 animate-pulse`}></div>)}
          </div>
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Global Node Network Online</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
