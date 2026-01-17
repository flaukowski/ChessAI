/**
 * Zero-Knowledge Proof Cryptography Library
 * Implements Schnorr-based ZKP for password authentication
 *
 * Protocol:
 * 1. Registration: User derives a secret key from password, computes public commitment
 * 2. Login: User proves knowledge of secret without revealing it
 *
 * Uses secp256k1 elliptic curve (same as Bitcoin/Ethereum)
 */

// secp256k1 curve parameters
const CURVE = {
  // Prime field
  p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
  // Curve order
  n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
  // Generator point
  Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
  // Curve coefficient a = 0
  a: BigInt(0),
  // Curve coefficient b = 7
  b: BigInt(7),
};

// Point on the curve (null represents point at infinity)
export interface Point {
  x: bigint;
  y: bigint;
}

// ZKP Commitment stored in database
export interface ZKPCommitment {
  publicKey: string; // hex-encoded point
  salt: string; // hex-encoded salt for password derivation
}

// ZKP Challenge from server
export interface ZKPChallenge {
  challenge: string; // hex-encoded challenge
  sessionId: string; // to correlate challenge with verification
}

// ZKP Proof from client
export interface ZKPProof {
  commitment: string; // R point (hex)
  response: string; // s value (hex)
  sessionId: string;
}

// Modular arithmetic helpers
function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = BigInt(1);
  base = mod(base, m);
  while (exp > 0) {
    if (exp & BigInt(1)) {
      result = mod(result * base, m);
    }
    exp = exp >> BigInt(1);
    base = mod(base * base, m);
  }
  return result;
}

function modInverse(a: bigint, m: bigint): bigint {
  return modPow(a, m - BigInt(2), m);
}

// Elliptic curve point operations
function isOnCurve(point: Point): boolean {
  const { x, y } = point;
  const left = mod(y * y, CURVE.p);
  const right = mod(x * x * x + CURVE.a * x + CURVE.b, CURVE.p);
  return left === right;
}

function pointAdd(p1: Point | null, p2: Point | null): Point | null {
  if (p1 === null) return p2;
  if (p2 === null) return p1;

  if (p1.x === p2.x && p1.y !== p2.y) {
    return null; // Point at infinity
  }

  let slope: bigint;
  if (p1.x === p2.x && p1.y === p2.y) {
    // Point doubling
    slope = mod(
      (BigInt(3) * p1.x * p1.x + CURVE.a) * modInverse(BigInt(2) * p1.y, CURVE.p),
      CURVE.p
    );
  } else {
    // Point addition
    slope = mod(
      (p2.y - p1.y) * modInverse(mod(p2.x - p1.x, CURVE.p), CURVE.p),
      CURVE.p
    );
  }

  const x3 = mod(slope * slope - p1.x - p2.x, CURVE.p);
  const y3 = mod(slope * (p1.x - x3) - p1.y, CURVE.p);

  return { x: x3, y: y3 };
}

function scalarMult(k: bigint, point: Point): Point | null {
  let result: Point | null = null;
  let addend: Point | null = point;

  while (k > 0) {
    if (k & BigInt(1)) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    k = k >> BigInt(1);
  }

  return result;
}

// Generator point G
const G: Point = { x: CURVE.Gx, y: CURVE.Gy };

// Hex encoding/decoding
function bigIntToHex(n: bigint, bytes: number = 32): string {
  return n.toString(16).padStart(bytes * 2, '0');
}

function hexToBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

function pointToHex(point: Point): string {
  // Compressed point format: 02/03 prefix + x coordinate
  const prefix = point.y % BigInt(2) === BigInt(0) ? '02' : '03';
  return prefix + bigIntToHex(point.x);
}

function hexToPoint(hex: string): Point {
  const prefix = hex.slice(0, 2);
  const x = hexToBigInt(hex.slice(2));

  // Calculate y from x
  const ySquared = mod(x * x * x + CURVE.b, CURVE.p);
  let y = modPow(ySquared, (CURVE.p + BigInt(1)) / BigInt(4), CURVE.p);

  // Choose correct y based on prefix
  if ((prefix === '02' && y % BigInt(2) !== BigInt(0)) ||
      (prefix === '03' && y % BigInt(2) === BigInt(0))) {
    y = CURVE.p - y;
  }

  return { x, y };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Cryptographic hash function (SHA-256)
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  } else {
    // Node.js environment
    const { createHash } = await import('crypto');
    return new Uint8Array(createHash('sha256').update(data).digest());
  }
}

// Generate cryptographically secure random bytes
async function randomBytes(length: number): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  } else {
    const { randomBytes: nodeRandomBytes } = await import('crypto');
    return new Uint8Array(nodeRandomBytes(length));
  }
}

// Derive a scalar from password using PBKDF2-like function
async function deriveSecretKey(password: string, salt: Uint8Array): Promise<bigint> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Combine password and salt
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes);
  combined.set(salt, passwordBytes.length);

  // Multiple rounds of hashing for key stretching
  let hash = await sha256(combined);
  for (let i = 0; i < 10000; i++) {
    const newInput = new Uint8Array(hash.length + salt.length);
    newInput.set(hash);
    newInput.set(salt, hash.length);
    hash = await sha256(newInput);
  }

  // Convert to scalar (mod n)
  let scalar = hexToBigInt(bytesToHex(hash));
  scalar = mod(scalar, CURVE.n - BigInt(1)) + BigInt(1); // Ensure non-zero

  return scalar;
}

// ============== PUBLIC API ==============

/**
 * Generate a ZKP commitment from a password (for registration)
 * Returns the public key commitment and salt to be stored
 */
export async function generateCommitment(password: string): Promise<ZKPCommitment> {
  // Generate random salt
  const salt = await randomBytes(32);

  // Derive secret key from password
  const secretKey = await deriveSecretKey(password, salt);

  // Compute public key: Y = G * x
  const publicKeyPoint = scalarMult(secretKey, G);
  if (!publicKeyPoint) {
    throw new Error('Failed to generate public key');
  }

  return {
    publicKey: pointToHex(publicKeyPoint),
    salt: bytesToHex(salt),
  };
}

/**
 * Generate a random challenge for ZKP verification (server-side)
 */
export async function generateChallenge(): Promise<ZKPChallenge> {
  const challengeBytes = await randomBytes(32);
  const sessionBytes = await randomBytes(16);

  return {
    challenge: bytesToHex(challengeBytes),
    sessionId: bytesToHex(sessionBytes),
  };
}

/**
 * Generate a ZKP proof (client-side)
 * Proves knowledge of password without revealing it
 */
export async function generateProof(
  password: string,
  salt: string,
  challenge: string,
  sessionId: string
): Promise<ZKPProof> {
  // Derive secret key from password
  const saltBytes = hexToBytes(salt);
  const secretKey = await deriveSecretKey(password, saltBytes);

  // Generate random nonce k
  const kBytes = await randomBytes(32);
  let k = hexToBigInt(bytesToHex(kBytes));
  k = mod(k, CURVE.n - BigInt(1)) + BigInt(1);

  // Compute commitment R = G * k
  const R = scalarMult(k, G);
  if (!R) {
    throw new Error('Failed to generate commitment');
  }

  // Convert challenge to scalar
  const c = mod(hexToBigInt(challenge), CURVE.n);

  // Compute response s = k + c * x (mod n)
  const s = mod(k + c * secretKey, CURVE.n);

  return {
    commitment: pointToHex(R),
    response: bigIntToHex(s),
    sessionId,
  };
}

/**
 * Verify a ZKP proof (server-side)
 * Returns true if the proof is valid
 */
export async function verifyProof(
  proof: ZKPProof,
  commitment: ZKPCommitment,
  challenge: string
): Promise<boolean> {
  try {
    // Parse values
    const R = hexToPoint(proof.commitment);
    const s = hexToBigInt(proof.response);
    const Y = hexToPoint(commitment.publicKey);
    const c = mod(hexToBigInt(challenge), CURVE.n);

    // Verify: G * s == R + Y * c
    const left = scalarMult(s, G);
    const Yc = scalarMult(c, Y);
    const right = pointAdd(R, Yc);

    if (!left || !right) {
      return false;
    }

    return left.x === right.x && left.y === right.y;
  } catch (error) {
    console.error('ZKP verification error:', error);
    return false;
  }
}

/**
 * Verify a password against a commitment (for password reset)
 * This regenerates the public key and compares
 */
export async function verifyPasswordCommitment(
  password: string,
  commitment: ZKPCommitment
): Promise<boolean> {
  try {
    const saltBytes = hexToBytes(commitment.salt);
    const secretKey = await deriveSecretKey(password, saltBytes);
    const publicKeyPoint = scalarMult(secretKey, G);

    if (!publicKeyPoint) {
      return false;
    }

    const computedPublicKey = pointToHex(publicKeyPoint);
    return computedPublicKey === commitment.publicKey;
  } catch (error) {
    return false;
  }
}

// Export for testing
export const _internal = {
  G,
  CURVE,
  scalarMult,
  pointAdd,
  sha256,
  deriveSecretKey,
  hexToPoint,
  pointToHex,
};
