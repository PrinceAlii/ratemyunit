import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { StarRating } from '../components/StarRating';
import type { Unit } from '@ratemyunit/types';

interface SearchResults extends Unit {
  averageRating: number;
  reviewCount: number;
}

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  // Filter States
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [faculty, setFaculty] = useState(searchParams.get('faculty') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'rating_desc');

  // Debounce Search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync with URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (faculty) params.faculty = faculty;
    if (minRating) params.minRating = minRating;
    if (sort) params.sort = sort;
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, faculty, minRating, sort, setSearchParams]);

  const { data: units, isLoading } = useQuery({
    queryKey: ['units', debouncedSearch, faculty, minRating, sort],
    queryFn: () => api.get<SearchResults[]>('/api/units/search', {
      q: debouncedSearch,
      faculty,
      minRating: minRating ? Number(minRating) : undefined,
      sort,
    }),
  });

  const faculties = [
    'Faculty of Engineering and IT',
    'Faculty of Arts and Social Sciences',
    'Faculty of Business',
    'Faculty of Design, Architecture and Building',
    'Faculty of Health',
    'Faculty of Law',
    'Faculty of Science',
    'TD School',
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Browse Units</h1>
          <p className="text-muted-foreground">
            Search, filter, and find the perfect subjects for your degree.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by unit code or name..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="md:w-auto"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <select
            className="flex h-10 w-full md:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="rating_desc">Highest Rated</option>
            <option value="rating_asc">Lowest Rated</option>
            <option value="most_reviewed">Most Reviewed</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-muted/30 rounded-lg border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <Label>Faculty</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
              >
                <option value="">All Faculties</option>
                {faculties.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Minimum Rating</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-card">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="hidden sm:flex flex-col items-end justify-center min-w-[120px] pl-4 border-l space-y-2">
                    <Skeleton className="h-10 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : units?.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <Filter className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium">No units found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or filters.
              </p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSearch('');
                  setFaculty('');
                  setMinRating('');
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {units?.map((unit) => (
                <div
                  key={unit.unitCode}
                  className="group relative flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/units/${unit.unitCode}`)}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">
                          {unit.unitCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                          {unit.creditPoints} CP
                        </span>
                      </div>
                      <div className="sm:hidden flex items-center gap-1">
                        <StarRating value={Number(unit.averageRating) || 0} readOnly size="sm" />
                        <span className="font-bold text-sm">{(Number(unit.averageRating) || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-xl group-hover:text-primary transition-colors">
                      {unit.unitName}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {unit.description || 'No description available.'}
                    </p>
                    
                    <div className="text-xs text-muted-foreground pt-2">
                      {unit.faculty}
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end justify-center min-w-[120px] pl-4 border-l">
                    <div className="text-3xl font-bold mb-1">
                      {(Number(unit.averageRating) || 0) > 0 ? (Number(unit.averageRating) || 0).toFixed(1) : '-'}
                    </div>
                    <StarRating value={Number(unit.averageRating) || 0} readOnly size="sm" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {unit.reviewCount || 0} {unit.reviewCount === 1 ? 'review' : 'reviews'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
