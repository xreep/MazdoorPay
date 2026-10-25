export default async function globalTeardown() {
  await globalThis.__MONGO__?.stop();
}
