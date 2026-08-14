/**
 * Ed25519 signature verification, reimplemented standalone against
 * tweetnacl directly (the same well-known, independent library the backend
 * uses) rather than calling into backend/src/crypto/engine.ts.
 */

import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

export function verifyEd25519(data: string, signatureBase64: string, publicKeyBase64: string): boolean {
  try {
    const dataBytes = naclUtil.decodeUTF8(data);
    const signatureBytes = naclUtil.decodeBase64(signatureBase64);
    const publicKeyBytes = naclUtil.decodeBase64(publicKeyBase64);
    return nacl.sign.detached.verify(dataBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
