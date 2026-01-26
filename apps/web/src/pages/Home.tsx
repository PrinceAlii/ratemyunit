import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Loader2 } from 'lucide-react';

export function HomePage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsSearching(true);
      navigate(`/browse?q=${encodeURIComponent(query)}`);
      setTimeout(() => setIsSearching(false), 500);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section - Asymmetrical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
        {/* Text Column - 7 cols */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h1 className="text-6xl md:text-8xl font-display font-black uppercase leading-none mb-4">
              Rate
              <span className="inline-block bg-secondary text-secondary-foreground px-3 py-1 border-3 border-foreground shadow-neo ml-3 -rotate-2">
                My
              </span>
              <br />
              Unit
            </h1>
            <div className="border-l-4 border-primary pl-4 mt-6">
              <p className="text-xl font-medium">
                Find easy electives, avoid nightmare subjects, and help your fellow students at UTS.
              </p>
            </div>
          </div>
        </div>

        {/* Search Column - 5 cols */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-6 w-6 text-muted-foreground pointer-events-none z-10" />
              <Input
                className="pl-14 h-16 text-lg border-4 shadow-neo hover:shadow-neo-lg transition-shadow"
                placeholder="Search for a unit code or name (e.g. 48024)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isSearching}
              />
            </div>
            <Button type="submit" className="w-full mt-4 h-14 text-lg" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                'Search Units'
              )}
            </Button>
            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => navigate('/browse')} className="font-bold">
                Or browse all units
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Feature Cards - Different Colors & Offset */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
        <div className="p-6 border-4 border-foreground bg-primary text-primary-foreground shadow-neo hover:shadow-neo-lg transition-all">
          <h3 className="text-xl font-display font-black uppercase mb-3">Anonymous Reviews</h3>
          <p className="font-medium">
            Share your honest feedback without fear. We protect your privacy while ensuring quality.
          </p>
        </div>
        <div className="p-6 border-4 border-foreground bg-secondary text-secondary-foreground shadow-neo hover:shadow-neo-lg transition-all md:mt-8">
          <h3 className="text-xl font-display font-black uppercase mb-3">Detailed Ratings</h3>
          <p className="font-medium">
            Rate teaching quality, workload, difficulty, and usefulness separately.
          </p>
        </div>
        <div className="p-6 border-4 border-foreground bg-accent text-accent-foreground shadow-neo hover:shadow-neo-lg transition-all">
          <h3 className="text-xl font-display font-black uppercase mb-3">Verified Students</h3>
          <p className="font-medium">
            See reviews from verified students to know you can trust the feedback.
          </p>
        </div>
      </div>
    </div>
  );
}
