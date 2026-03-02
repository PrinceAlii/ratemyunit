import assert from 'node:assert/strict';
import {
  extractUnswCodesFromSearchResponse,
  extractUnswSearchSummary,
  extractUsydCodesFromSeoHtml,
  extractUsydSeoPageUrls,
  extractUtsCodesFromAlphaHtml,
  normalizeAndUniqueCodes,
} from '../rebuild-uts-unsw-templates.helpers.js';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('normalizeAndUniqueCodes trims, uppercases, dedupes and sorts', () => {
  const result = normalizeAndUniqueCodes([' comp1511 ', 'COMP1511', 'math1131', 'MATH1131']);
  assert.deepEqual(result, ['COMP1511', 'MATH1131']);
});

run('extractUtsCodesFromAlphaHtml keeps only subject links with digits', () => {
  const html = `
    <a href="https://www.handbook.uts.edu.au/subjects/31268.html">Web Systems</a>
    <a href="/subjects/013992.html">Aboriginal Sydney Now</a>
    <a href="/subjects/index.html">Subjects Index</a>
    <a href="/subjects/COMP1511.html">Not UTS but has digits</a>
    <a href="/subjects/abcde.html">No digits</a>
  `;

  const result = extractUtsCodesFromAlphaHtml(html);
  assert.deepEqual(result, ['013992', '31268', 'COMP1511']);
});

run('extractUnswCodesFromSearchResponse parses and dedupes codes', () => {
  const payload = {
    response: {
      results: [
        { integrat_coursecode: 'comp1511' },
        { integrat_coursecode: ' COMP1511 ' },
        { integrat_coursecode: 'MATH1131' },
        { integrat_coursecode: null },
      ],
    },
  };

  const result = extractUnswCodesFromSearchResponse(payload);
  assert.deepEqual(result, ['COMP1511', 'MATH1131']);
});

run('extractUnswSearchSummary reads result packet metadata', () => {
  const payload = {
    response: {
      resultPacket: {
        resultsSummary: {
          pageNumber: 2,
          pageRecordCount: 500,
          totalRecordCount: 1835,
        },
      },
    },
  };

  const result = extractUnswSearchSummary(payload);
  assert.deepEqual(result, {
    pageNumber: 2,
    pageRecordCount: 500,
    totalRecordCount: 1835,
  });
});

run('extractUnswSearchSummary throws on invalid payload', () => {
  assert.throws(
    () => extractUnswSearchSummary({ response: { resultPacket: { resultsSummary: {} } } }),
    /missing pageNumber/
  );
});

run('extractUsydSeoPageUrls parses and normalizes seo page links', () => {
  const html = `
    <a href="/students/units/seo.1.html">1</a>
    <a href="https://www.sydney.edu.au/students/units/seo.14.html">14</a>
    <a href="/students/units/seo.html">index</a>
  `;

  const result = extractUsydSeoPageUrls(html, 'https://www.sydney.edu.au/students/units/seo.html');
  assert.deepEqual(result, [
    'https://www.sydney.edu.au/students/units/seo.1.html',
    'https://www.sydney.edu.au/students/units/seo.14.html',
    'https://www.sydney.edu.au/students/units/seo.html',
  ]);
});

run('extractUsydCodesFromSeoHtml parses valid /units code links', () => {
  const html = `
    <a href="/units/comp2017">Lowercase</a>
    <a href="https://www.sydney.edu.au/units/MATH1061">Absolute</a>
    <a href="/units/INFO1110/2026-S1C-ND-CC">Variant path</a>
    <a href="/units/TESTVLAD">Not valid code format</a>
  `;

  const result = extractUsydCodesFromSeoHtml(html);
  assert.deepEqual(result, ['COMP2017', 'INFO1110', 'MATH1061']);
});
