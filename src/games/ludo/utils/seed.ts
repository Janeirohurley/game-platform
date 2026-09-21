export function createSeed(): number {
  const buffer = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
    return buffer[0] >>> 0;
  }
  let candidate = 0;
  for (let i = 0; i < 4; i++) {
    candidate = (candidate << 8) | (Math.random() * 256);
  }
  return candidate >>> 0;
}
