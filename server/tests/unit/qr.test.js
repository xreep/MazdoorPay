import { signWorkerCode, readWorkerCode } from '../../src/services/qr.service.js';

const ID = '64b7f0c2a1b2c3d4e5f6a001';

describe('worker card codes', () => {
  it('signs a worker id and card version, and reads them back', () => {
    const code = signWorkerCode(ID, 3);
    expect(code).toMatch(/^MP1\.64b7f0c2a1b2c3d4e5f6a001\.3\.[A-Za-z0-9_-]{16}$/);
    expect(readWorkerCode(code)).toEqual({ workerId: ID, version: 3 });
  });

  it('rejects a code whose id, version or signature was changed', () => {
    const code = signWorkerCode(ID, 1);
    const [prefix, , version, sig] = code.split('.');
    expect(readWorkerCode(`${prefix}.64b7f0c2a1b2c3d4e5f6a002.${version}.${sig}`)).toBeNull();
    expect(readWorkerCode(`${prefix}.${ID}.2.${sig}`)).toBeNull();
    expect(readWorkerCode(`${prefix}.${ID}.${version}.${'A'.repeat(16)}`)).toBeNull();
  });

  it('rejects anything that is not a MazdoorPay card', () => {
    for (const bad of [
      '',
      'hello',
      'https://example.com',
      `MP2.${ID}.1.abc`,
      `MP1.${ID}.x.abc`,
      null,
    ])
      expect(readWorkerCode(bad)).toBeNull();
  });
});
