// One-subsystem shim: canonical implementation lives in
// @zoveli/math-intelligence; this package re-exports it so existing
// imports (`@zoveli/math`) and tests keep working with zero drift.
export * from '@zoveli/math-intelligence';
export { default } from '@zoveli/math-intelligence';
