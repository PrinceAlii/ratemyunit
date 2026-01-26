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
    <div className="container mx-auto px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full text-center space-y-8 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          RateMyUnit
        </h1>
        <p className="text-xl text-muted-foreground">
          Find easy electives, avoid nightmare subjects, and help your fellow students at UTS.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-xl relative">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 h-12 text-lg"
            placeholder="Search for a unit code or name (e.g. 48024)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
          />
          <Button type="submit" className="absolute right-1 top-1 bottom-1" disabled={isSearching}>
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      <div className="mt-8">
        <Button variant="link" onClick={() => navigate('/browse')}>
          Or browse all units
        </Button>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div className="p-6 border rounded-lg bg-card text-card-foreground">
          <h3 className="text-lg font-bold mb-2">Anonymous Reviews</h3>
          <p className="text-muted-foreground">
            Share your honest feedback without fear. We protect your privacy while ensuring quality.
          </p>
        </div>
        <div className="p-6 border rounded-lg bg-card text-card-foreground">
          <h3 className="text-lg font-bold mb-2">Detailed Ratings</h3>
          <p className="text-muted-foreground">
            Rate teaching quality, workload, difficulty, and usefulness separately.
          </p>
        </div>
        <div className="p-6 border rounded-lg bg-card text-card-foreground">
          <h3 className="text-lg font-bold mb-2">Verified Students</h3>
          <p className="text-muted-foreground">
            See reviews from verified students to know you can trust the feedback.
          </p>
        </div>
      </div>
    </div>
  );
}
