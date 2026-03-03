'use client';

import { useState } from 'react';

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';

interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
];

interface LanguageSelectorProps {
  value: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
  disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = LANGUAGES.find((l) => l.code === value) || LANGUAGES[0];

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        Language
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-3
          bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600
          rounded-lg shadow-sm text-left
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 cursor-pointer'}
          transition-colors duration-200
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{getLanguageEmoji(selected.code)}</span>
          <div>
            <span className="font-medium text-slate-900 dark:text-white">
              {selected.nativeName}
            </span>
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
              ({selected.name})
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onChange(lang.code);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left
                hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors
                ${lang.code === value ? 'bg-blue-50 dark:bg-slate-700' : ''}
              `}
            >
              <span className="text-lg">{getLanguageEmoji(lang.code)}</span>
              <div>
                <span className="font-medium text-slate-900 dark:text-white">
                  {lang.nativeName}
                </span>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  ({lang.name})
                </span>
              </div>
              {lang.code === value && (
                <svg className="ml-auto w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getLanguageEmoji(code: SupportedLanguage): string {
  const emojis: Record<SupportedLanguage, string> = {
    en: '🇬🇧',
    hi: '🇮🇳',
    ta: '🇮🇳',
    te: '🇮🇳',
    bn: '🇮🇳',
    mr: '🇮🇳',
  };
  return emojis[code] || '🌐';
}
