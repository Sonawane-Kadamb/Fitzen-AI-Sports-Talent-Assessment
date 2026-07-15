/**
 * Device signing identity.
 *
 * Each device generates one ECDSA P-256 keypair on first use and persists it
 * in IndexedDB. Every assessment captured on this device is signed with it,
 * making results tamper-evident and attributable to the capturing device.
 */

import { generateAssessmentKeyPair, publicKeyFingerprint, type AssessmentKeyPair } from '@fitzen/engines';
import { idb } from './idb';

const KEY_ID = 'device-signing-keypair';

let cached: AssessmentKeyPair | null = null;

export async function getDeviceKeyPair(): Promise<AssessmentKeyPair> {
  if (cached) return cached;
  const stored = await idb.get<AssessmentKeyPair>('keys', KEY_ID);
  if (stored?.privateKeyJwk && stored.publicKeyJwk) {
    cached = stored;
    return stored;
  }
  const fresh = await generateAssessmentKeyPair();
  await idb.put('keys', fresh, KEY_ID);
  cached = fresh;
  return fresh;
}

export async function getDeviceFingerprint(): Promise<string> {
  const pair = await getDeviceKeyPair();
  return publicKeyFingerprint(pair.publicKeyJwk);
}
