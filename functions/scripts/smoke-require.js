try {
  require('../lib/refresh/runRefresh.js');
  process.stdout.write('OK: runRefresh loaded\n');
} catch (e) {
  console.error(e);
  process.exit(1);
}
