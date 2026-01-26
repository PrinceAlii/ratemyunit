import { describe, it, expect } from 'vitest';
import { parseSubjectToUnit } from '../parser';
import type { ScrapedSubjectData } from '../types';

describe('Performance: UTS Scraper Parser', () => {
  // Create varied test data to prevent CPU cache benefits.
  const generateMockData = (index: number): ScrapedSubjectData => ({
    code: `3${1000 + index}`,
    name: `Test Subject ${index}`,
    description: `Description for subject ${index}. `.repeat(10),
    creditPoints: 6,
    faculty: `Faculty ${index % 5}`,
    prerequisites: index % 2 === 0 ? `Prerequisite ${index - 1}` : undefined,
    antiRequisites: index % 3 === 0 ? `Anti-req ${index}` : undefined,
    sessions: [`Autumn ${2024 + (index % 3)}`],
  });

  it('parses 1000 subjects efficiently', () => {
    const count = 1000;
    const warmupCount = 100;

    // Warm-up phase to allow V8 JIT optimization.
    for (let i = 0; i < warmupCount; i++) {
      parseSubjectToUnit(generateMockData(i) as any);
    }

    // Actual benchmark with multiple runs.
    const runs = 10;
    const durations: number[] = [];

    for (let run = 0; run < runs; run++) {
      const startTime = performance.now();

      for (let i = 0; i < count; i++) {
        const result = parseSubjectToUnit(generateMockData(i) as any);
        // Use result to prevent optimization.
        expect(result.unitCode).toBeDefined();
      }

      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    // Calculate statistics.
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Log results for visibility.
    console.log(`Performance Statistics (${count} subjects):`);
    console.log(`  Mean: ${mean.toFixed(2)}ms`);
    console.log(`  Median: ${median.toFixed(2)}ms`);
    console.log(`  P95: ${p95.toFixed(2)}ms`);

    // Assert reasonable performance (generous threshold).
    expect(mean).toBeLessThan(500);
    expect(p95).toBeLessThan(750);
  });

  it('handles memory efficiently', () => {
    const count = 1000;
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < count; i++) {
      parseSubjectToUnit(generateMockData(i) as any);
    }

    // Force garbage collection if available (run with --expose-gc).
    if (global.gc) {
      global.gc();
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = memAfter - memBefore;

    console.log(`Memory delta: ${(memDelta / 1024 / 1024).toFixed(2)}MB`);

    // Should not leak significant memory (allow 10MB delta).
    expect(memDelta).toBeLessThan(10 * 1024 * 1024);
  });
});
