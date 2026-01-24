import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Input } from '../components/ui/input';
import { Search } from 'lucide-react';
import type { Unit } from '@ratemyunit/types';

export function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Partial<Unit>[]>([]);
  const navigate = useNavigate();

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }

    try {
      const data = await api.get<Partial<Unit>[]>(`/api/units/search?q=${value}`);
      setResults(data);
    } catch (err) {
      console.error(err);
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

      <div className="w-full max-w-xl relative">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 h-12 text-lg"
            placeholder="Search for a unit code or name (e.g. 48024)"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {results.length > 0 && (
          <div className="absolute w-full mt-2 bg-popover text-popover-foreground border rounded-md shadow-lg overflow-hidden z-10">
            {results.map((unit) => (
              <button
                key={unit.unitCode}
                className="w-full text-left px-4 py-3 hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0"
                onClick={() => navigate(`/units/${unit.unitCode}`)}
              >
                <div className="font-semibold">{unit.unitCode}</div>
                <div className="text-sm text-muted-foreground">{unit.unitName}</div>
              </button>
            ))}
          </div>
        )}
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
