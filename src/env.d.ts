// src/env.d.ts
/// <reference types="astro/client" />

// Untuk import JSON biasa
declare module "*.json" {
  const value: any;
  export default value;
}

// Untuk import dengan ?raw
declare module "*?raw" {
  const value: string; // File yang diimpor dengan ?raw akan menjadi string
  export default value;
}
