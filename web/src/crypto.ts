import nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

// Simple symmetric wrapper (NOT production ready – demonstration only)
export function generateKey(): Uint8Array {
  return nacl.randomBytes(32);
}

export function encrypt(plain: string, key: Uint8Array): { nonce: string; cipher: string } {
  const nonce = nacl.randomBytes(24);
  const msg = util.decodeUTF8(plain);
  const cipher = nacl.secretbox(msg, nonce, key);
  return { nonce: util.encodeBase64(nonce), cipher: util.encodeBase64(cipher) };
}

export function decrypt(cipher: string, nonce: string, key: Uint8Array): string | null {
  const c = util.decodeBase64(cipher);
  const n = util.decodeBase64(nonce);
  const plain = nacl.secretbox.open(c, n, key);
  if (!plain) return null;
  return util.encodeUTF8(plain);
}
