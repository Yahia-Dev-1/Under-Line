import React, { useState, useEffect } from 'react';

const SavedTranslations = ({ user, onViewTranslation, onBack, filterMode = 'all' }) => {
    const [translations, setTranslations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTranslations();
    }, []);

    const fetchTranslations = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/translations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                throw new Error('Your session has expired. Please log out and sign in again.');
            }
            if (!response.ok) throw new Error('Failed to fetch translations');

            const data = await response.json();

            // Filter based on mode
            let allTranslations = data.translations || [];
            if (filterMode === 'terms') {
                allTranslations = allTranslations.filter(t => t.isKeyTermsMode === true || t.isKeyTermsMode === 'true');
            } else {
                // Show everything else in History (Standard + Insights)
                allTranslations = allTranslations.filter(t => !t.isKeyTermsMode || t.isKeyTermsMode === 'false' || t.isKeyTermsMode === false);
            }

            setTranslations(allTranslations);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteTranslation = async (id) => {
        if (!confirm('Are you sure you want to delete this translation?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3000/translations/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete');

            setTranslations(translations.filter(t => t.id !== id));
        } catch (err) {
            alert('Error deleting translation');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-blue-100 rounded-full animate-ping"></div>
                        <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={onBack}
                    className="text-primary font-bold flex items-center hover:bg-primary/5 p-2 rounded-lg transition-all"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="text-right">
                    <h1 className="text-2xl font-black text-gray-800">{filterMode === 'terms' ? 'My Terminology' : 'My History'}</h1>
                    <p className="text-gray-500">{translations.length} {filterMode === 'terms' ? 'terminology sets' : 'saved items'}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium">
                    {error}
                </div>
            )}

            {translations.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No {filterMode === 'terms' ? 'key terms' : 'translations'} yet</h3>
                    <p className="text-gray-500">Start using the app to save content!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {translations.map((translation) => (
                        <div
                            key={translation.id}
                            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${filterMode === 'terms' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                                            {filterMode === 'terms' ? 'Terminology' : translation.targetLang}
                                        </span>
                                        <span className="text-gray-400 text-sm">
                                            {formatDate(translation.createdAt)}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">
                                        {translation.fileName || 'Untitled'}
                                    </h3>
                                    <p className="text-gray-500 text-sm line-clamp-2">
                                        {translation.segments?.[0]?.original?.substring(0, 150)}...
                                    </p>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                                        <span>{translation.segments?.length || 0} {filterMode === 'terms' ? 'terms' : 'segments'}</span>
                                        <span>•</span>
                                        <span>Mode: {translation.isInsightMode ? 'Insight' : translation.isKeyTermsMode ? 'Terminology' : translation.splitMode}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => onViewTranslation(translation)}
                                        className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() => deleteTranslation(translation.id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedTranslations;
