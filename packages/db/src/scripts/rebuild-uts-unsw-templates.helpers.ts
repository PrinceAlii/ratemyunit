type UnswSearchResult = {
  integrat_coursecode?: unknown;
};

type UnswSearchResponse = {
  response?: {
    results?: UnswSearchResult[];
    resultPacket?: {
      resultsSummary?: {
        pageNumber?: unknown;
        pageRecordCount?: unknown;
        totalRecordCount?: unknown;
      };
    };
  };
};

export type UnswSearchSummary = {
  pageNumber: number;
  pageRecordCount: number;
  totalRecordCount: number;
};

const UTS_CODE_LINK_REGEX = /\/subjects\/([A-Za-z0-9]{4,10})\.html/g;

const CODE_HAS_DIGIT_REGEX = /\d/;

export function normalizeAndUniqueCodes(codes: string[]): string[] {
  return Array.from(
    new Set(
      codes
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function extractUtsCodesFromAlphaHtml(html: string): string[] {
  const matches: string[] = [];

  for (const match of html.matchAll(UTS_CODE_LINK_REGEX)) {
    const code = match[1];
    if (!CODE_HAS_DIGIT_REGEX.test(code)) {
      continue;
    }
    matches.push(code);
  }

  return normalizeAndUniqueCodes(matches);
}

export function extractUnswCodesFromSearchResponse(payload: unknown): string[] {
  const data = payload as UnswSearchResponse;
  const results = Array.isArray(data?.response?.results) ? data.response.results : [];

  const codes = results
    .map((item) => item?.integrat_coursecode)
    .filter((value): value is string => typeof value === 'string');

  return normalizeAndUniqueCodes(codes);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function extractUnswSearchSummary(payload: unknown): UnswSearchSummary {
  const data = payload as UnswSearchResponse;
  const rawSummary = data?.response?.resultPacket?.resultsSummary;

  const pageNumber = toNumber(rawSummary?.pageNumber);
  const pageRecordCount = toNumber(rawSummary?.pageRecordCount);
  const totalRecordCount = toNumber(rawSummary?.totalRecordCount);

  if (!pageNumber || pageNumber < 1) {
    throw new Error('Invalid UNSW response: missing pageNumber');
  }

  if (pageRecordCount === null || pageRecordCount < 0) {
    throw new Error('Invalid UNSW response: missing pageRecordCount');
  }

  if (totalRecordCount === null || totalRecordCount < 0) {
    throw new Error('Invalid UNSW response: missing totalRecordCount');
  }

  return {
    pageNumber,
    pageRecordCount,
    totalRecordCount,
  };
}
