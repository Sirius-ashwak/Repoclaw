'use client';

/**
 * ArtifactCarousel Component
 * Swipeable carousel for displaying generated artifacts
 */

import { useState } from 'react';
import { Artifact, ExportFormat } from '@/types';

interface ArtifactCarouselProps {
  artifacts: Artifact[];
  onExport: (format: ExportFormat) => void;
}

export default function ArtifactCarousel({ artifacts, onExport }: ArtifactCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (artifacts.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 text-center text-gray-500">
        No artifacts available yet
      </div>
    );
  }

  const currentArtifact = artifacts[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? artifacts.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === artifacts.length - 1 ? 0 : prev + 1));
  };

  const renderArtifactPreview = (artifact: Artifact) => {
    switch (artifact.type) {
      case 'readme':
      case 'api-docs':
        return (
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
              {artifact.content}
            </pre>
          </div>
        );

      case 'demo-url':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">🚀</div>
            <a
              href={artifact.metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-lg font-medium"
            >
              {artifact.metadata.url}
            </a>
            {artifact.metadata.qrCode && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Scan to view on mobile:</p>
                <img
                  src={artifact.metadata.qrCode}
                  alt="QR Code"
                  className="mx-auto w-48 h-48"
                />
              </div>
            )}
          </div>
        );

      case 'architecture-diagram':
        return (
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded font-mono">
              {artifact.content}
            </pre>
          </div>
        );

      case 'pitch-deck':
        return (
          <div className="space-y-4">
            {artifact.metadata.slides?.map((slide: any, index: number) => (
              <div key={index} className="border rounded-lg p-4 bg-white">
                <h3 className="text-xl font-bold mb-2">{slide.title}</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{slide.content}</p>
              </div>
            ))}
          </div>
        );

      case 'pitch-script':
        return (
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
              {artifact.content}
            </pre>
          </div>
        );

      case 'pull-request':
        return (
          <div className="space-y-4">
            <div className="text-center text-6xl">🔀</div>
            <div className="text-center">
              <a
                href={artifact.metadata.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-lg font-medium"
              >
                View Pull Request #{artifact.metadata.prNumber}
              </a>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-semibold mb-2">{artifact.metadata.title}</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {artifact.metadata.body}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-gray-500">
            <p>Preview not available for this artifact type</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Artifacts</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => onExport('pdf')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export PDF
          </button>
          <button
            onClick={() => onExport('pr-link')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Copy PR Link
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Navigation Buttons */}
        {artifacts.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10"
            >
              ←
            </button>
            <button
              onClick={goToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10"
            >
              →
            </button>
          </>
        )}

        {/* Artifact Card */}
        <div className="border-2 rounded-lg p-6 bg-white shadow-lg">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">{currentArtifact.title}</h3>
            <p className="text-sm text-gray-500">Type: {currentArtifact.type}</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {renderArtifactPreview(currentArtifact)}
          </div>
        </div>

        {/* Indicators */}
        {artifacts.length > 1 && (
          <div className="flex justify-center mt-4 space-x-2">
            {artifacts.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Artifact Counter */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Artifact {currentIndex + 1} of {artifacts.length}
      </div>
    </div>
  );
}


// Named export for compatibility
export { ArtifactCarousel };
