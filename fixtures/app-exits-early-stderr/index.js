// Exits 1 with distinctive stderr before opening any port.
// BootProof must classify this as app_exited_early and surface the stderr
// in the explanation field.
process.stderr.write("BOOTPROOF_DISTINCTIVE_STDERR_MARKER:cannot start, config missing\n");
process.stderr.write("second line of diagnostic output\n");
process.exit(1);
