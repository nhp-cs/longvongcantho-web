const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['uploadthing-client-entry.js'],
  outfile: 'public/js/uploadthing-client.js',
  bundle: true,
  format: 'iife',
  globalName: 'UploadThingClient',
  platform: 'browser',
  target: ['es2020'],
});
