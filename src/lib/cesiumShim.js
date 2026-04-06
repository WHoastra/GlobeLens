// Shim that re-exports window.Cesium (loaded via script tag)
// This prevents webpack/SWC from bundling and transpiling Cesium source
module.exports = typeof window !== "undefined" ? window.Cesium : {};
