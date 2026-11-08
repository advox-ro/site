// WebAssembly imported as a Worker module (see src/lib/og.ts).
declare module '*.wasm?module' {
  const module: WebAssembly.Module;
  export default module;
}
