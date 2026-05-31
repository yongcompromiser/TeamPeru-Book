'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NaverBook {
  title: string;
  author: string;
  description: string;
  image: string;
  isbn: string;
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
  const [results, setResults] = useState<NaverBook[]>([]);
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
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
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

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

  const handleSelect = (book: NaverBook) => {
    onSelect({
      title: stripHtml(book.title),
      author: stripHtml(book.author),
      description: stripHtml(book.description),
      coverUrl: book.image || undefined,
      isbn: book.isbn?.split(' ')[1] || book.isbn || undefined,
    });

    setQuery(stripHtml(book.title));
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
          {results.map((book, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(book)}
              className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 text-left border-b last:border-0"
            >
              {book.image ? (
                <img
                  src={book.image}
                  alt={stripHtml(book.title)}
                  className="w-12 h-16 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {stripHtml(book.title)}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {stripHtml(book.author) || '저자 미상'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
