import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Search, Filter, SlidersHorizontal, School } from 'lucide-react';
import { StarRating } from '../components/StarRating';
import type { UnitWithStats, University } from '@ratemyunit/types';

interface SearchResults extends UnitWithStats {
  reviewCount: number;
}

interface PaginatedResponse<T> {
  data: T;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [faculty, setFaculty] = useState(searchParams.get('faculty') || '');
  const [universityId, setUniversityId] = useState(searchParams.get('universityId') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'rating_desc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const limit = 20;

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (faculty) params.faculty = faculty;
    if (universityId) params.universityId = universityId;
    if (minRating) params.minRating = minRating;
    if (sort) params.sort = sort;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, faculty, universityId, minRating, sort, page, setSearchParams]);

  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.get<University[]>('/api/public/universities'),
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ['units', debouncedSearch, faculty, universityId, minRating, sort, page],
    queryFn: () => api.get<PaginatedResponse<SearchResults[]>>('/api/units/search', {
      q: debouncedSearch,
      faculty,
      universityId,
      minRating: minRating ? Number(minRating) : undefined,
      sort,
      limit,
      offset: (page - 1) * limit,
    }),
  });

  const units = response?.data;
  const pagination = response?.pagination;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch distinct faculties for the selected university so the filter reflects real data.
  const { data: availableFaculties } = useQuery({
    queryKey: ['faculties', universityId],
    queryFn: () => api.get<string[]>('/api/public/faculties', universityId ? { universityId } : undefined),
    enabled: true,
  });

  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const { totalPages, page: currentPage } = pagination;
    const pages = [];
    
    // Simple pagination logic: show current, first, last, and neighbors
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return (
      <div className="flex flex-wrap justify-center items-center gap-2 mt-12 pb-8">
        <Button
          variant="outline"
          className="border-3 border-foreground font-black uppercase disabled:opacity-30"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Prev
        </Button>
        
        {pages.map((p, idx) => (
          typeof p === 'number' ? (
            <Button
              key={idx}
              variant={p === currentPage ? 'default' : 'outline'}
              className={`min-w-[48px] border-3 border-foreground font-black ${p === currentPage ? 'bg-primary text-primary-foreground shadow-none translate-x-1 translate-y-1' : 'hover:bg-primary/20'}`}
              onClick={() => handlePageChange(p)}
            >
              {p}
            </Button>
          ) : (
            <span key={idx} className="px-2 font-black">...</span>
          )
        ))}

        <Button
          variant="outline"
          className="border-3 border-foreground font-black uppercase disabled:opacity-30"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-black uppercase mb-2">Browse Units</h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-lg font-medium">
              Search subjects across all Australian universities.
            </p>
            {pagination && pagination.total > 0 && (
              <p className="text-sm font-black uppercase bg-muted px-3 py-1 border-2 border-foreground">
                Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} units
              </p>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by code (e.g. 31251) or name..."
              className="pl-12 h-14 text-lg border-4 shadow-neo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="md:w-auto h-14 border-4"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-2 h-5 w-5" />
            Filters
          </Button>
          <select
            className="flex h-14 w-full md:w-[200px] border-4 border-input bg-background px-4 py-2 text-base font-medium shadow-neo-sm focus:outline-none focus:shadow-neo disabled:cursor-not-allowed disabled:opacity-50"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="rating_desc">Highest Rated</option>
            <option value="rating_asc">Lowest Rated</option>
            <option value="most_reviewed">Most Reviewed</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-6 bg-secondary border-4 border-foreground shadow-neo-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <Label className="font-bold">Faculty</Label>
              <select
                className="flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
                value={faculty}
                onChange={(e) => {
                  setFaculty(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Faculties</option>
                {availableFaculties?.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">University</Label>
              <select
                className="flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
                value={universityId}
                onChange={(e) => {
                  setUniversityId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Universities</option>
                {universities?.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Minimum Rating</Label>
              <select
                className="flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
                value={minRating}
                onChange={(e) => {
                  setMinRating(e.target.value);
                  setPage(1);
                }}
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
                  setUniversityId('');
                  setPage(1);
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {units?.map((unit) => (
                  <div
                    key={unit.unitCode}
                    className="group relative flex flex-col sm:flex-row gap-4 p-5 border-4 border-foreground bg-card shadow-neo hover:shadow-neo-lg hover:-translate-y-1 transition-all cursor-pointer"
                    onClick={() => navigate(`/units/${unit.unitCode}`)}
                  >
                    <div className="flex-1 space-y-2">
                      {/* Header Row: University Badge & Code */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {unit.universityAbbr && (
                            <span className="flex items-center gap-1.5 px-2 py-1 bg-primary text-primary-foreground text-xs font-black uppercase border-2 border-foreground">
                              <School className="h-3 w-3" />
                              {unit.universityAbbr}
                            </span>
                          )}
                          <span className="font-mono font-black text-lg px-2 py-1 border-3 border-foreground bg-muted inline-block">
                            {unit.unitCode}
                          </span>
                          <span className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-black uppercase border-2 border-foreground">
                            {unit.creditPoints} CP
                          </span>
                        </div>
                        <div className="sm:hidden flex items-center gap-1">
                          <StarRating value={Number(unit.averageRating) || 0} readOnly size="sm" />
                          <span className="font-bold text-sm">{(Number(unit.averageRating) || 0).toFixed(1)}</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-xl group-hover:text-primary transition-colors">
                        {unit.unitName}
                      </h3>

                      <p className="text-sm font-medium line-clamp-2">
                        {unit.description || 'No description available.'}
                      </p>

                      <div className="text-xs font-medium text-muted-foreground pt-2">
                        {unit.faculty}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end justify-center min-w-[140px] pl-6 border-l-4 border-foreground">
                      <div className="text-5xl font-black text-primary mb-1">
                        {(Number(unit.averageRating) || 0) > 0 ? (Number(unit.averageRating) || 0).toFixed(1) : '-'}
                      </div>
                      <StarRating value={Number(unit.averageRating) || 0} readOnly size="sm" />
                      <div className="text-xs font-bold text-muted-foreground mt-2">
                        {unit.reviewCount || 0} {unit.reviewCount === 1 ? 'review' : 'reviews'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}