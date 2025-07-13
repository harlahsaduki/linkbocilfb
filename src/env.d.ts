/// <reference path="../.astro/types.d.ts" />
declare module "*.json" {
  const value: any; // Or specify a more precise type if you want, e.g., VideoData[]
  export default value;
}
