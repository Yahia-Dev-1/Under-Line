import React from 'react';

const Header = ({ user, onLogout, onShowAuth, onShowSaved }) => {
    return (
        <header className="bg-white/95 backdrop-blur-xl relative z-100 py-4 px-6 md:px-12 flex justify-between items-center border-b border-gray-100 shadow-sm animate-fade-in">
            {/* Logo Section */}
            <div className="flex items-center">
                <div className="relative w-40 h-40 flex items-center justify-start overflow-hidden rounded-xl transition-transform hover:scale-105 duration-300">
                    <img 
                        src="/src/assets/logo.jpg" 
                        alt="UnderLine Logo" 
                        className="w-full h-full object-contain"
                    />
                </div>
            </div>

            {/* Nav Section - Always visible */}
            <div className="flex items-center gap-3">
                {/* History Button - Always visible */}
                <button
                    onClick={onShowSaved}
                    className="bg-gray-100 hover:bg-primary/10 text-gray-700 hover:text-primary px-5 py-3 rounded-2xl font-black flex items-center gap-2 transition-all text-xs uppercase tracking-widest btn-hover-scale"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="hidden sm:inline">History</span>
                </button>

                {user ? (
                    <>
                        {/* User Info */}
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
                        <div className="w-7 h-7 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xs">
                                    {user.name?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-gray-700 font-medium text-sm hidden sm:block">{user.name}</span>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={onLogout}
                            className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 px-4 py-2.5 rounded-xl font-semibold transition-all text-sm"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { onShowAuth(); setAuthView && setAuthView('login'); }}
                            className="text-gray-600 hover:text-primary px-5 py-3 rounded-2xl font-black transition-all text-xs uppercase tracking-widest btn-hover-scale"
                        >
                            Login
                        </button>

                        {/* Sign Up Button */}
                        <button
                            onClick={() => { onShowAuth(); setAuthView && setAuthView('register'); }}
                            className="bg-primary text-white px-6 py-3 rounded-2xl font-black transition-all text-xs uppercase tracking-widest shadow-lg shadow-primary/20 btn-hover-scale"
                        >
                            Sign Up
                        </button>
                    </>
                )}
            </div>
        </header>
    );
};

export default Header;
