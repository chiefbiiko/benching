import { benchmark, runBenchmarks, BenchmarkTimer } from "./mod.ts";

benchmark(function forIncrementX1e9(b: BenchmarkTimer) {
  b.start();
  for (let i: number = 0; i < 1e9; i++);
  b.stop();
});

benchmark(function forDecrementX1e9(b: BenchmarkTimer) {
  b.start();
  for (let i: number = 1e9; i > 0; i--);
  b.stop();
});

benchmark(async function forAwaitFetchDenolandX10(b: BenchmarkTimer) {
  b.start();
  for (let i: number = 0; i < 10; i++) {
    await fetch("https://deno.land/");
  }
  b.stop();
});

benchmark(async function promiseAllFetchDenolandX10(b: BenchmarkTimer) {
  const urls = new Array(10).fill("https://deno.land/");
  b.start();
  await Promise.all(urls.map((denoland: string) => fetch(denoland)));
  b.stop();
});

benchmark({
  name: "runs100ForIncrementX1e6",
  runs: 100,
  func() { // Benchmark defintions with runs will not get a timer passed to func
    for (let i: number = 0; i < 1e6; i++);
  }
});

benchmark(function throwing(b: BenchmarkTimer) {
  b.start();
  throw new Error("oops");
});

runBenchmarks({ skip: /throw/ });
