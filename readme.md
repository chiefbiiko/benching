# benching

[![Travis](http://img.shields.io/travis/chiefbiiko/benching.svg?style=flat)](http://travis-ci.org/chiefbiiko/benching) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/chiefbiiko/benching?branch=master&svg=true)](https://ci.appveyor.com/project/chiefbiiko/benching)

---

Bike-shed benchmarking module. Provides flintstone millisecond resolution.

---

## Import

```ts
import * as benching from "https://deno.land/x/benching/mod.ts";
```

---

## Usage

```ts
import {
  BenchmarkTimer,
  runBenchmarks,
  benchmark
} from "https://deno.land/x/benching/mod.ts";

// Simple
benchmark(function forIncrementX1e9(b: BenchmarkTimer) {
  b.start();
  for (let i = 0; i < 1e9; i++);
  b.stop();
});

// Benchmark definitions with runs will not get a timer passed to func
// Reporting average execution time for $runs runs of func
benchmark({
  name: "runs100ForIncrementX1e6",
  runs: 100,
  func() {
    for (let i: number = 0; i < 1e6; i++);
  }
});

// Itsabug
benchmark(function throwing(b) {
  b.start();
  throw new Error("oops");
});

// Bench control
runBenchmarks({ skip: /throw/ });
```

---

## API

#### `benchmark(bench: BenchmarkDefinition | BenchmarkFunction): void`

Register a benchmark that will be run once `runBenchmarks` is called.

#### `runBenchmarks(opts?: BenchmarkRunOptions): Promise<void>`

Run all registered benchmarks serially. Filtering can be applied by setting 
`BenchmarkRunOptions.only` and/or `BenchmarkRunOptions.skip` to regular expressions matching benchmark names.

#### Other exports

```ts
export interface BenchmarkTimer {
  start: () => void;
  stop: () => void;
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
```

---

## License

[MIT](./license.md)