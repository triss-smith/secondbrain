declare module 'd3-force-3d' {
  export interface SimNode {
    x: number
    y: number
    z: number
    [key: string]: unknown
  }

  export interface SimLink<N> {
    source: N | string
    target: N | string
    [key: string]: unknown
  }

  interface Simulation<N> {
    force(name: string, force: unknown): this
    stop(): this
    tick(): void
  }

  interface ForceLink<N> {
    id(fn: (d: N) => string): this
    links(links: SimLink<N>[]): this
    strength(value: number | ((l: SimLink<N>) => number)): this
    distance(value: number | ((l: SimLink<N>) => number)): this
  }

  interface ForceManyBody<N> {
    strength(value: number | ((node: N) => number)): this
  }

  interface ForceCenter {
    strength(value: number): this
  }

  export function forceSimulation<N>(nodes?: N[], nDim?: number): Simulation<N>
  export function forceLink<N>(links?: SimLink<N>[]): ForceLink<N>
  export function forceManyBody<N>(): ForceManyBody<N>
  export function forceCenter<N>(x?: number, y?: number, z?: number): ForceCenter
}
