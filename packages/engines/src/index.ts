/**
 * @fitzen/engines — pure, isomorphic domain engines for Fitzen.
 *
 * These modules contain no I/O and no framework dependencies so they can run
 * unchanged in the browser (on-device inference), in the Node API server
 * (authoritative verification), and in the test suite.
 */

// Jump estimation
export * from './jump/types.js';
export * from './jump/uncertainty.js';
export { analyzeJump, type AnalyzeOptions } from './jump/jumpAnalyzer.js';
export { simulateJump, type SimulateJumpOptions } from './jump/simulateJump.js';

// Cryptographic assessment engine
export * from './crypto/assessmentCrypto.js';

// Potential score engine
export * from './potential/potentialScore.js';

// Gamification
export * from './gamification/badges.js';
