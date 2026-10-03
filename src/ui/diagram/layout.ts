// Runs elkjs in its own worker, so laying out a large diagram does not freeze the page. The worker is
// started when the first diagram needs a layout.
import * as elkApi from 'elkjs/lib/elk-api.js';
import type ElkConstructor from 'elkjs/lib/elk-api.js';
import { elkLayout, type Layout } from './elk-layout.ts';

export type { Layout, LayoutRequest, LayoutResult } from './elk-layout.ts';

/**
 * elkjs is a CommonJS bundle whose export is the constructor itself, also under `default`. Depending
 * on the tool that bundles it, the namespace import is the constructor or an object that wraps it.
 */
function constructorOf(module: unknown): typeof ElkConstructor {
  let found = module;
  while (typeof found !== 'function' && typeof found === 'object' && found && 'default' in found) {
    found = found.default;
  }
  return found as typeof ElkConstructor;
}

let elk: InstanceType<typeof ElkConstructor> | undefined;

// Async, so a browser without workers reports a failed layout instead of throwing from an effect.
export const workerLayout: Layout = async (request) => {
  elk ??= new (constructorOf(elkApi))({
    workerFactory: () => new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url)),
  });
  return elkLayout(elk, request);
};
