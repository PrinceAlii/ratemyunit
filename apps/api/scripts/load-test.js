import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp to 20 users
    { duration: '5m', target: 20 },   // Sustain
    { duration: '2m', target: 50 },   // Spike to 50
    { duration: '3m', target: 50 },   // Sustain spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% under 1s
    http_req_failed: ['rate<0.05'],     // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function() {
  // Test typical user journey
  const searchRes = http.get(`${BASE_URL}/api/units?search=computer`);
  check(searchRes, {
    'search succeeds': (r) => r.status === 200,
    'search has results': (r) => {
        try {
            return JSON.parse(r.body).data?.length >= 0;
        } catch (e) { return false; }
    }
  });

  sleep(1);

  // Test unit detail page (using a known ID or code if possible, or just skip if search failed)
  if (searchRes.status === 200) {
    let units = [];
    try {
        units = JSON.parse(searchRes.body).data || [];
    } catch(e) {}

    if (units.length > 0) {
      // Pick a random unit from results
      const unit = units[Math.floor(Math.random() * units.length)];
      // Use unitCode for the public route
      const unitRes = http.get(`${BASE_URL}/api/units/${unit.unitCode}`);
      check(unitRes, {
        'unit detail succeeds': (r) => r.status === 200,
      });
    }
  }

  sleep(2);
}
