'use client';

/**
 * ModeSelector Component
 * Displays three mode cards for Hackathon, Placement, and Refactor
 * Allows user to select optimization mode for the pipeline
 */

import { useState } from 'react';
import { Mode } from '@/types';
import { getModeDescription, getModeDisplayName } from '@/lib/mode-config';

interface ModeSelectorProps {
  onModeSelect: (mode: Mode) => void;
  disabled?: boolean;
}

interface ModeCardData {
  mode: Mode;
  icon: string;
  color: string;
  features: string[];
}

const MODE_CARDS: ModeCardData[] = [
  {
    mode: 'hackathon',
    icon: '🚀',
    color: 'border-purple-500 hover:bg-purple-50',
    features: [
      'Live demo deployment',
      'Compelling pitch deck',
      'Quick start guide',
      'Visual appeal focus',
    ],
  },
  {
    mode: 'placement',
    icon: '💼',
    color: 'border-blue-500 hover:bg-blue-50',
    features: [
      'Comprehensive docs',
      'Technical depth',
      'Code quality focus',
      'Professional presentation',
    ],
  },
  {
    mode: 'refactor',
    icon: '🔧',
    color: 'border-green-500 hover:bg-green-50',
    features: [
      'Code analysis',
      'Improvement suggestions',
      'Best practices',
      'Maintainability focus',
    ],
  },
];

export default function ModeSelector({ onModeSelect, disabled = false }: ModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);

  const handleModeClick = (mode: Mode) => {
    if (disabled) return;
    setSelectedMode(mode);
    onModeSelect(mode);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Choose Your Optimization Mode</h2>
        <p className="text-gray-600">
          Select how you want RepoClaw to optimize your repository
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MODE_CARDS.map((card) => (
          <button
            key={card.mode}
            onClick={() => handleModeClick(card.mode)}
            disabled={disabled}
            className={`
              relative p-6 rounded-lg border-2 transition-all duration-200
              ${card.color}
              ${selectedMode === card.mode ? 'ring-4 ring-offset-2 ring-blue-400' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              hover:shadow-lg
            `}
          >
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">{card.icon}</div>
              <h3 className="text-2xl font-bold">{getModeDisplayName(card.mode)}</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">{getModeDescription(card.mode)}</p>

            <div className="space-y-2">
              {card.features.map((feature, idx) => (
                <div key={idx} className="flex items-start text-sm">
                  <span className="mr-2">✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {selectedMode === card.mode && (
              <div className="absolute top-2 right-2">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  ✓
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedMode && (
        <div className="mt-6 text-center text-sm text-gray-600">
          Selected: {getModeDisplayName(selectedMode)} mode
        </div>
      )}
    </div>
  );
}


// Named export for compatibility
export { ModeSelector };
