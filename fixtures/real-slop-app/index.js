// A real, minimal "slop" app: installs clean, starts, then deliberately
// crashes with SIGSEGV. This is the shape of AI-generated code that merges
// clean and dies in production — BootProof captures the real crash.
const http = require('node:http');
const port = parseInt(process.env.PORT || '3000', 10);

console.log('initializing worker pool...');
console.log('binding 0.0.0.0:' + port + '...');

// Simulate the kind of runtime crash that AI code is famous for:
// a function that "looks fine" but dereferences an invalid pointer.
// In Node we can't truly deref a null pointer, but we CAN raise SIGSEGV
// via process.kill — which produces a real, kernel-level SIGSEGV exit,
// exactly matching what a Rust/C/C++ "slop" binary would do.
setTimeout(() => {
  console.log('accepting connections...');
  // Real SIGSEGV — kernel-level signal, captured as exit signal SIGSEGV.
  process.kill(process.pid, 'SIGSEGV');
}, 200);
