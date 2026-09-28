/* Static images bundled with the app resolve to a Metro asset id. */
declare module '*.png' {
  const source: number
  export default source
}
