type QueueSource = 'single' | 'bulk' | 'range' | 'discovery';

interface QueueSourceCounters {
  single: number;
  bulk: number;
  range: number;
  discovery: number;
}

interface DiagnosticsState {
  startedAt: string;
  browser: {
    crashLikeErrorsTotal: number;
    recoveryAttemptsTotal: number;
    recoverySuccessTotal: number;
    recoveryFailureTotal: number;
  };
  queue: {
    enqueueRequestedTotal: number;
    addCallsTotal: number;
    addBulkCallsTotal: number;
    addBulkErrorsTotal: number;
    discoveryScanEnqueueCallsTotal: number;
    inputTotalBySource: QueueSourceCounters;
    normalizedInputTotalBySource: QueueSourceCounters;
    requestedBySource: QueueSourceCounters;
    inputDuplicatesRemovedTotal: number;
    skippedAlreadyIndexedTotal: number;
    knownAlreadyQueuedTotal: number;
    estimatedJobIdCollisionSignalsTotal: number;
    jobIdCollisionSignalsAreApproximate: boolean;
    jobIdCollisionSignalsMethod: 'timestamp_before_batch_start';
  };
}

interface AddedJobLike {
  timestamp?: number;
}

const createSourceCounters = (): QueueSourceCounters => ({
  single: 0,
  bulk: 0,
  range: 0,
  discovery: 0,
});

const state: DiagnosticsState = {
  startedAt: new Date().toISOString(),
  browser: {
    crashLikeErrorsTotal: 0,
    recoveryAttemptsTotal: 0,
    recoverySuccessTotal: 0,
    recoveryFailureTotal: 0,
  },
  queue: {
    enqueueRequestedTotal: 0,
    addCallsTotal: 0,
    addBulkCallsTotal: 0,
    addBulkErrorsTotal: 0,
    discoveryScanEnqueueCallsTotal: 0,
    inputTotalBySource: createSourceCounters(),
    normalizedInputTotalBySource: createSourceCounters(),
    requestedBySource: createSourceCounters(),
    inputDuplicatesRemovedTotal: 0,
    skippedAlreadyIndexedTotal: 0,
    knownAlreadyQueuedTotal: 0,
    estimatedJobIdCollisionSignalsTotal: 0,
    jobIdCollisionSignalsAreApproximate: true,
    jobIdCollisionSignalsMethod: 'timestamp_before_batch_start',
  },
};

export function recordBrowserCrashLikeError() {
  state.browser.crashLikeErrorsTotal += 1;
}

export function recordBrowserRecoveryAttempt() {
  state.browser.recoveryAttemptsTotal += 1;
}

export function recordBrowserRecoveryOutcome(success: boolean) {
  if (success) {
    state.browser.recoverySuccessTotal += 1;
    return;
  }

  state.browser.recoveryFailureTotal += 1;
}

export function recordQueueInputNormalization(
  source: QueueSource,
  inputCount: number,
  normalizedCount: number,
  alreadyIndexedCount: number
) {
  state.queue.inputTotalBySource[source] += Math.max(0, inputCount);
  state.queue.normalizedInputTotalBySource[source] += Math.max(0, normalizedCount);
  state.queue.inputDuplicatesRemovedTotal += Math.max(0, inputCount - normalizedCount);
  state.queue.skippedAlreadyIndexedTotal += Math.max(0, alreadyIndexedCount);
}

export function recordKnownAlreadyQueuedSkip(count = 1) {
  state.queue.knownAlreadyQueuedTotal += Math.max(0, count);
}

export function recordSingleEnqueue() {
  state.queue.addCallsTotal += 1;
  state.queue.enqueueRequestedTotal += 1;
  state.queue.requestedBySource.single += 1;
}

export function recordDiscoveryScanEnqueue() {
  state.queue.addCallsTotal += 1;
  state.queue.discoveryScanEnqueueCallsTotal += 1;
}

export function recordEnqueueBatchResult(
  source: Exclude<QueueSource, 'single'>,
  requestedCount: number,
  addedJobs: AddedJobLike[],
  batchStartedAtMs: number
) {
  const safeRequestedCount = Math.max(0, requestedCount);

  state.queue.addBulkCallsTotal += 1;
  state.queue.enqueueRequestedTotal += safeRequestedCount;
  state.queue.requestedBySource[source] += safeRequestedCount;

  const estimatedCollisions = addedJobs.reduce((total, job) => {
    if (typeof job.timestamp === 'number' && job.timestamp < batchStartedAtMs) {
      return total + 1;
    }
    return total;
  }, 0);

  state.queue.estimatedJobIdCollisionSignalsTotal += estimatedCollisions;
}

export function recordEnqueueBatchError() {
  state.queue.addBulkErrorsTotal += 1;
}

export function getScraperDiagnosticsSnapshot() {
  const now = Date.now();
  const startedAtMs = Date.parse(state.startedAt);

  return {
    startedAt: state.startedAt,
    generatedAt: new Date(now).toISOString(),
    uptimeMs: Number.isNaN(startedAtMs) ? 0 : Math.max(0, now - startedAtMs),
    browser: { ...state.browser },
    queue: {
      ...state.queue,
      inputTotalBySource: { ...state.queue.inputTotalBySource },
      normalizedInputTotalBySource: { ...state.queue.normalizedInputTotalBySource },
      requestedBySource: { ...state.queue.requestedBySource },
    },
  };
}
