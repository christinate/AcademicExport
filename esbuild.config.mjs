import esbuild from "esbuild";
import process from "process";
import { readFile } from "node:fs/promises";

const production = process.argv[2] === "production";
const safeDocxPolyfills = {
  name: "safe-docx-polyfills",
  setup(build) {
    build.onLoad({ filter: /docx[\\/]dist[\\/]index\.mjs$/ }, async ({ path }) => {
      let source = await readFile(path, "utf8");
      const scriptCreation = 'createElement("scr' + 'ipt")';
      const dynamicCallback = /new\s+Function\(""\s*\+\s*([A-Za-z_$][\w$]*)\)/g;
      const scriptCount = source.split(scriptCreation).length - 1;
      const callbackCount = [...source.matchAll(dynamicCallback)].length;
      if (scriptCount !== 4 || callbackCount !== 1) throw new Error(`Unexpected docx polyfill structure: ${scriptCount} script fallbacks and ${callbackCount} dynamic callbacks.`);
      source = source.replaceAll(scriptCreation, 'createElement("span")').replace(dynamicCallback, 'function(){throw new TypeError("setImmediate callback must be a function")}');
      return { contents: source, loader: "js" };
    });
  }
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  minify: production,
  sourcemap: production ? false : "inline",
  treeShaking: true,
  plugins: [safeDocxPolyfills],
  loader: { ".md": "text", ".ttf": "base64", ".woff2": "base64" },
  outfile: "main.js"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
