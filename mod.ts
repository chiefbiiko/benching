// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { exit, noColor } from "deno";

/** Provides methods for starting and stopping a benchmark clock. */
export interface BenchmarkTimer {
  start: () => void;
  stop: () => void;
}

/** Defines a benchmark through a named function. */
export type BenchmarkFunction = {
  (b: BenchmarkTimer): void | Promise<void>;
  name: string;
};

/** Defines a benchmark definition with configurable runs. */
export interface BenchmarkDefinition {
  func: BenchmarkFunction;
  name: string;
  runs?: number;
}

/** Defines runBenchmark's run constraints by matching benchmark names. */
export interface BenchmarkRunOptions {
  only?: RegExp;
  skip?: RegExp;
}

interface BenchmarkClock {
  start: number;
  stop: number;
}

interface BenchmarkMeta {
  filtered: number;
  measured: number;
  failed: boolean;
}

interface BenchmarkResult {
  index: number;
  timings: Array<number>;
  printed: boolean;
  failed?: boolean;
}

interface BenchmarkResults {
  [key: string]: BenchmarkResult;
}

function red(text: string): string {
  return noColor ? text : `\x1b[31m${text}\x1b[0m`;
}

function blue(text: string): string {
  return noColor ? text : `\x1b[34m${text}\x1b[0m`;
}

function verifyOr1Run(runs?: number): number {
  return runs && runs >= 1 && runs !== Infinity ? Math.floor(runs) : 1;
}

function average(nums: Array<number>): number {
  return nums.reduce((acc: number, cur: number) => acc + cur, 0) / nums.length;
}

function report(name: string, timings: Array<number>): string {
  if (timings.length === 1) {
    return `benchmark ${name} ... ` + blue(`${timings[0]}ms`);
  } else {
    return (
      `benchmark ${name} ... ` +
      blue(`${average(timings)}ms`) +
      ` (average over ${timings.length} runs)`
    );
  }
}

function fail(name: string) {
  return `benchmark ${name} ... ${red("failed")}`;
}

function unresolve(name: string) {
  return `benchmark ${name} ... unresolved`;
}

function logPendingResults(results: BenchmarkResults): void {
  Object.entries(results)
    .filter((kv: Array<any>): boolean => kv[1].timings && !kv[1].printed)
    .forEach(
      (kv: Array<any>): void => console.log(report(kv[0], kv[1].timings))
    );
}

function logFailingResults(results: BenchmarkResults): void {
  Object.entries(results).forEach(
    (kv: Array<any>): void => {
      if (!kv[1].printed && !kv[1].failed && kv[1].timings) {
        console.log(report(kv[0], kv[1].timings));
      } else if (!kv[1].printed && kv[1].failed) {
        console.log(fail(kv[0]));
      } else {
        console.log(unresolve(kv[0]));
      }
    }
  );
}

function assertTiming(clock: BenchmarkClock): void {
  // NaN indicates that a benchmark has not been timed properly
  if (!clock.stop) {
    throw new Error("The benchmark timer's stop method must be called");
  } else if (!clock.start) {
    throw new Error("The benchmark timer's start method must be called");
  } else if (clock.start > clock.stop) {
    throw new Error(
      "The benchmark timer's start method must be called before its " +
        "stop method"
    );
  }
}

function createBenchmarkTimer(clock: BenchmarkClock): BenchmarkTimer {
  return {
    start(): void {
      clock.start = performance.now();
    },
    stop(): void {
      clock.stop = performance.now();
    }
  };
}

function createRunner(func: BenchmarkFunction): () => Promise<number> {
  return async (): Promise<number> => {
    // clock and b are specific for this runner
    const clock: BenchmarkClock = { start: NaN, stop: NaN };
    const b: BenchmarkTimer = createBenchmarkTimer(clock);
    // Running the benchmark function
    await func(b);
    // Making sure the benchmark was started/stopped properly
    assertTiming(clock);
    // Returning measured time
    return clock.stop - clock.start;
  };
}

function initRunners(
  func: BenchmarkFunction,
  runs: number
): Array<Promise<number>> {
  return new Array(runs)
    .fill(null)
    .map((): Promise<number> => createRunner(func)());
}

function createBenchmarkResults(
  benchmarks: Array<BenchmarkDefinition>
): BenchmarkResults {
  return benchmarks.reduce(
    (
      acc: BenchmarkResults,
      cur: BenchmarkDefinition,
      i: number
    ): BenchmarkResults => {
      acc[cur.name] = { index: i, timings: null, printed: false };
      return acc;
    },
    {}
  );
}

async function createBenchmark(
  { name, runs, func }: BenchmarkDefinition,
  results: BenchmarkResults,
  meta: BenchmarkMeta
): Promise<void> {
  // Running the current benchmark
  try {
    results[name].timings = await Promise.all(initRunners(func, runs));
  } catch (err) {
    meta.failed = results[name].failed = true;
    throw err;
  }
  // Index of the current benchmark
  const curIndex = results[name].index;
  // Checking whether the previous promise has resolved yet
  const prevResolved = Object.values(results).some(
    ({ index, timings }): boolean => {
      return Array.isArray(timings) && index === curIndex - 1;
    }
  );
  // Reporting right now if all previous resolved
  if (curIndex === 0 || prevResolved) {
    results[name].printed = true;
    console.log(report(name, results[name].timings));
  }
  // Counting measurements
  meta.measured++;
}

function initBenchmarks(
  benchmarks: Array<BenchmarkDefinition>,
  results: BenchmarkResults,
  meta: BenchmarkMeta
): Array<Promise<void>> {
  return benchmarks.map(
    (benchmark: BenchmarkDefinition): Promise<void> => {
      return createBenchmark(benchmark, results, meta);
    }
  );
}

const candidates: Array<BenchmarkDefinition> = [];

/** Registers a benchmark as a candidate for the runBenchmarks executor. */
export function bench(
  benchmark: BenchmarkDefinition | BenchmarkFunction
): void {
  if (!benchmark.name) {
    throw new Error("The benchmark function must not be anonymous");
  }
  if (typeof benchmark === "function") {
    candidates.push({ name: benchmark.name, runs: 1, func: benchmark });
  } else {
    candidates.push({
      name: benchmark.name,
      runs: verifyOr1Run(benchmark.runs),
      func: benchmark.func
    });
  }
}

/** Runs all registered and non-skipped benchmarks serially. */
export async function runBenchmarks(opts?: BenchmarkRunOptions): Promise<void> {
  // Fallback fallthrough regex
  opts = Object.assign({ only: /[^\s]/, skip: /^\s*$/ }, opts || {});
  // Filtering candidates by the "only" and "skip" constraint
  const benchmarks: Array<BenchmarkDefinition> = candidates.filter(
    ({ name }) => opts.only.test(name) && !opts.skip.test(name)
  );
  // Init main counters and error flag
  const meta: BenchmarkMeta = {
    filtered: candidates.length - benchmarks.length,
    measured: 0,
    failed: false
  };
  // Simple result store
  const results: BenchmarkResults = createBenchmarkResults(benchmarks);
  // Running all benchmarks
  console.log(
    "running",
    benchmarks.length,
    `benchmark${benchmarks.length === 1 ? " ..." : "s ..."}`
  );
  try {
    await Promise.all(initBenchmarks(benchmarks, results, meta));
    logPendingResults(results);
  } catch (err) {
    logFailingResults(results);
  }
  // Closing results
  console.log(
    `benchmark result: ${meta.failed ? red("FAIL") : blue("DONE")}. ` +
      `${meta.measured} measured; ${meta.filtered} filtered`
  );
  // Making sure the program exit code is not zero in case of failure
  if (meta.failed) {
    setTimeout(() => exit(1), 0);
  }
}
