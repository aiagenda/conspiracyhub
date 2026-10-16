import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Match the app's alias and bundler-style extensionless imports in Node's TS runner.
registerHooks({ resolve(specifier, context, nextResolve) {
  let candidate;
  if (specifier.startsWith('@/')) candidate = pathToFileURL(resolve('src', specifier.slice(2))).href;
  else if (specifier.startsWith('.') && context.parentURL) candidate = new URL(specifier, context.parentURL).href;
  if (candidate?.startsWith('file:')) {
    for (const suffix of ['', '.ts', '.tsx', '.js']) {
      const url = candidate + suffix;
      if (existsSync(fileURLToPath(url)) && /\.(ts|tsx|js)$/.test(url)) return nextResolve(url, context);
    }
  }
  return nextResolve(specifier, context);
}});
