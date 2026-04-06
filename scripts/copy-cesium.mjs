import { cpSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cesiumSource = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

if (!existsSync(dest)) {
  mkdirSync(dest, { recursive: true });
}

const dirs = ["Workers", "ThirdParty", "Assets", "Widgets"];
for (const dir of dirs) {
  const src = join(cesiumSource, dir);
  const out = join(dest, dir);
  if (existsSync(src)) {
    cpSync(src, out, { recursive: true, force: true });
    console.log(`  Copied ${dir}`);
  }
}

console.log("Cesium static assets copied to public/cesium/");

// Download higher-res Moon texture if not already present
const moon2kPath = join(dest, "Assets", "Textures", "moon2k.jpg");
if (!existsSync(moon2kPath)) {
  console.log("  Downloading 2K Moon texture...");
  try {
    const res = await fetch("https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg");
    if (res.ok) {
      const { writeFileSync } = await import("fs");
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(moon2kPath, buffer);
      console.log("  Moon 2K texture saved");
    }
  } catch (e) {
    console.warn("  Could not download Moon texture:", e.message);
  }
}
