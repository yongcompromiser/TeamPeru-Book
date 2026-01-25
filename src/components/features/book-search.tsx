'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
    };
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
  };
}

interface BookSearchResult {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  isbn?: string;
}

interface BookSearchProps {
  onSelect: (book: BookSearchResult) => void;
}

export function BookSearch({ onSelect }: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchBooks = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&langRestrict=ko`
        );
        const data = await response.json();
        setResults(data.items || []);
        setShowResults(true);
      } catch (error) {
        console.error('Failed to search books:', error);
        setResults([]);
      }
      setIsLoading(false);
    };

    const debounce = setTimeout(searchBooks, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (book: GoogleBook) => {
    const isbn = book.volumeInfo.industryIdentifiers?.find(
      (id) => id.type === 'ISBN_13' || id.type === 'ISBN_10'
    )?.identifier;

    onSelect({
      title: book.volumeInfo.title,
      author: book.volumeInfo.authors?.join(', ') || '',
      description: book.volumeInfo.description,
      coverUrl: book.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      isbn,
    });

    setQuery(book.volumeInfo.title);
    setShowResults(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="책 제목을 검색하세요..."
          className="pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleSelect(book)}
              className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 text-left border-b last:border-0"
            >
              {book.volumeInfo.imageLinks?.thumbnail ? (
                <img
                  src={book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                  alt={book.volumeInfo.title}
                  className="w-12 h-16 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {book.volumeInfo.title}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {book.volumeInfo.authors?.join(', ') || '저자 미상'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
