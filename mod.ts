import { exit } from "deno";

interface BenchmarkClock {
  start: number;
  stop: number;
}

export interface BenchmarkTimer {
  start: () => void;
  stop: () => void;
}

function createBenchmarkTimer(clock: BenchmarkClock): BenchmarkTimer {
  return {
    start(): void {
      clock.start = Date.now();
    },
    stop(): void {
      clock.stop = Date.now();
    }
  };
}

export type BenchmarkFunction = {
  (b: BenchmarkTimer): void | Promise<void>;
  name: string;
};

export interface BenchmarkDefinition {
  func: BenchmarkFunction;
  name: string;
  runs?: number;
}

export interface BenchmarkRunOptions {
  only?: RegExp;
  skip?: RegExp;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function blue(text: string): string {
  return `\x1b[34m${text}\x1b[0m`;
}

function assertTiming(clock): void {
  // Making sure the benchmark was started/stopped properly
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

const candidates: Array<BenchmarkDefinition> = [];

export function benchmark(
  bench: BenchmarkDefinition | BenchmarkFunction
): void {
  if (!bench.name) {
    throw new Error("The benchmark function must not be anonymous");
  }
  if (typeof bench === "function") {
    candidates.push({ name: bench.name, runs: 1, func: bench });
  } else {
    candidates.push({
      name: bench.name,
      runs: bench.runs && bench.runs >= 1 ? bench.runs | 0 : 1,
      func: bench.func
    });
  }
}

export async function runBenchmarks({
  only = /[^\s]+/,
  skip = /^\s*$/
}: BenchmarkRunOptions): Promise<void> {
  // Filtering candidates by the "only" and "skip" constraint
  const benchmarks: BenchmarkDefinition[] = candidates.filter(({ name }) => {
    return only.test(name) && !skip.test(name);
  });
  // Init main counters and error flag
  const filtered: number = candidates.length - benchmarks.length;
  let measured: number = 0;
  let failed: boolean = false;
  // Setting up a shared benchmark clock and timer
  const clock: BenchmarkClock = { start: NaN, stop: NaN };
  const b: BenchmarkTimer = createBenchmarkTimer(clock);
  // Iterating given benchmark definitions (await-in-loop)
  console.log(
    "running",
    benchmarks.length,
    `benchmark${benchmarks.length === 1 ? " ..." : "s ..."}`
  );
  for (const { func, name, runs } of benchmarks) {
    // See https://github.com/denoland/deno/pull/1452 about groupCollapsed
    console.groupCollapsed(`benchmark ${name} ... `);
    // Trying benchmark.func
    let result: string;
    try {
      if (runs === 1) {
        await func(b);
        assertTiming(clock);
        result = `${clock.stop - clock.start}ms`;
      } else if (runs > 1) {
        // Averaging runs
        let pending = runs;
        let total: number = 0;
        while (true) {
          await func(b);
          assertTiming(clock);
          total += clock.stop - clock.start;
          if (!--pending) {
            result = `runs: ${runs}; avg: ${total / runs}ms`;
            break;
          }
        }
      }
      // Timing
      console.log(blue(result));
      console.groupEnd();
      measured++;
    } catch (err) {
      failed = true;
      console.groupEnd();
      console.error(red(err.stack));
      break;
    }
    // Resetting the benchmark clock
    clock.start = clock.stop = NaN;
  }
  // Log results
  console.log(
    `benchmark result: ${failed ? red("FAIL") : blue("DONE")}. ` +
      `${measured} measured; ${filtered} filtered`
  );
  // Making sure the program exit code is not zero in case of failure
  if (failed) {
    setTimeout(() => exit(1), 0);
  }
}
