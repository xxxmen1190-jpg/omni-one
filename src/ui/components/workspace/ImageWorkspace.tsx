import React, { useState } from "react";

interface ImageWorkspaceProps {
  content: string;
  imageUrls?: string[];
}

const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({ content, imageUrls }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Extract image URLs from content (markdown images)
  const extractedUrls = extractImageUrls(content);
  const allImages = [...(imageUrls || []), ...extractedUrls];

  if (allImages.length === 0) {
    return (
      <div className="p-4 text-ink-400 text-sm text-center">
        <div className="text-4xl mb-2">🖼️</div>
        <p>{content}</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Image grid */}
      <div
        className={`grid gap-3 ${
          allImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {allImages.map((url, i) => (
          <div
            key={i}
            className="relative group cursor-pointer rounded-lg overflow-hidden border border-ink-700/50 hover:border-purple-500/50 transition-colors"
            onClick={() => setSelectedImage(url)}
          >
            <img
              src={url}
              alt={`Generated image ${i + 1}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm bg-black/50 px-2 py-1 rounded transition-opacity">
                View full size
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Non-image content */}
      {content && !content.includes("![") && (
        <p className="mt-3 text-sm text-ink-400">{content}</p>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-ink-300"
            >
              ✕
            </button>

            {/* Zoom controls */}
            <div className="absolute -top-10 left-0 flex gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="text-white bg-ink-700 hover:bg-ink-600 px-2 py-1 rounded text-sm"
              >
                −
              </button>
              <span className="text-white text-sm py-1">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="text-white bg-ink-700 hover:bg-ink-600 px-2 py-1 rounded text-sm"
              >
                +
              </button>
              <a
                href={selectedImage}
                download
                className="text-white bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                ↓ Download
              </a>
            </div>

            <div className="overflow-auto max-h-[80vh]">
              <img
                src={selectedImage}
                alt="Full size"
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s" }}
                className="max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  const mdImageRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

export default ImageWorkspace;
