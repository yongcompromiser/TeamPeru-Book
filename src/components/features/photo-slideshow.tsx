'use client';

import { useState, useEffect } from 'react';

interface Photo {
  url: string;
  title: string;
  author: string;
}

export function PhotoSlideshow() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  useEffect(() => {
    if (photos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [photos.length]);

  const fetchPhotos = async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();

      if (data.photos && data.photos.length > 0) {
        // Shuffle photos
        const shuffled = [...data.photos].sort(() => Math.random() - 0.5);
        setPhotos(shuffled);
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 md:h-80 bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center">
        <span className="text-gray-400">로딩중...</span>
      </div>
    );
  }

  if (photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden shadow-lg">
      {/* Photo */}
      <div className="absolute inset-0">
        {photos.map((photo, index) => (
          <img
            key={index}
            src={photo.url}
            alt={photo.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>

      {/* Overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <p className="font-medium truncate">{currentPhoto.title}</p>
        <p className="text-sm text-white/80">{currentPhoto.author}</p>
      </div>

      {/* Dots indicator */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1">
          {photos.slice(0, Math.min(photos.length, 10)).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex % Math.min(photos.length, 10)
                  ? 'bg-white'
                  : 'bg-white/40'
              }`}
            />
          ))}
          {photos.length > 10 && (
            <span className="text-white/60 text-xs ml-1">+{photos.length - 10}</span>
          )}
        </div>
      )}
    </div>
  );
}
