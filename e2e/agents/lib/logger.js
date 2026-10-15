export function createLogger(verbose = true) {
  return {
    info(msg) {
      if (verbose) console.log(msg);
    },
    warn(msg) {
      console.warn(msg);
    },
    error(msg) {
      console.error(msg);
    },
  };
}
