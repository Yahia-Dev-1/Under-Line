import React, { useState } from 'react';

const Hero = ({ onStart }) => {
    const [showVideo, setShowVideo] = useState(false);

    return (
        <section className="relative py-20 px-6 md:px-12 overflow-hidden bg-transparent">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -mr-64 -mt-64 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary-light/10 rounded-full blur-[120px] -ml-48 -mb-48 animate-pulse delay-1000"></div>

            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
                {/* Text Content */}
                <div className="lg:w-1/2 text-center lg:text-left z-10 animate-fade-in-up">
                    <h1 className="text-7xl md:text-9xl font-black text-primary-dark leading-[0.85] mb-12 tracking-tighter">
                        Translate <br />
                        <span className="shimmer-text">Smartly</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-500 mb-14 max-w-xl mx-auto lg:mx-0 font-medium leading-[1.6]">
                        Precision text alignment for researchers. <br className="hidden md:block" />
                        <span className="text-primary/60">
                            AI-powered semantic grouping ensures perfect context preservation.
                        </span>
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
                        <button
                            onClick={onStart}
                            className="gradient-button px-20 py-7 rounded-[2.5rem] font-black text-2xl shadow-2xl text-white group"
                        >
                            <span className="flex items-center gap-3">
                                Start Now
                                <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </span>
                        </button>


                    </div>
                </div>

               
                            
               
            </div>

            {/* Video Modal */}
            {showVideo && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-12 animate-fade-in">
                    <div
                        className="absolute inset-0 bg-slate-900/90 backdrop-blur-3xl"
                        onClick={() => setShowVideo(false)}
                    ></div>

                    <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[4rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.6)] border border-white/10 animate-fade-in-up">
                        <button
                            onClick={() => setShowVideo(false)}
                            className="absolute top-8 right-8 z-10 w-14 h-14 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-xl transition-all group"
                        >
                            <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="w-full h-full flex flex-col items-center justify-center text-white p-16 text-center">
                            <div className="w-32 h-32 bg-primary/20 rounded-full flex items-center justify-center mb-8 animate-glow">
                                <svg className="w-16 h-16 ml-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                            <h3 className="text-5xl font-black mb-6 tracking-tighter">Experience Precision</h3>
                            <p className="text-slate-400 max-w-xl text-xl font-medium leading-relaxed">
                                UnderLine AI transforms the way researchers work with global texts.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Hero;
