import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'

const apiSyncPlugin = () => ({
  name: 'api-sync',
  configureServer(server) {
    server.middlewares.use('/api/sync', (req, res) => {
      console.log('--- REMOTE TRIGGER: RUNNING SYNC SCRIPTS ---');
      res.setHeader('Content-Type', 'text/plain');
      
      const child = exec('node scripts/fetch-wiki-images.js && node scripts/build-wiki-data.js');
      
      child.stdout.on('data', (data) => {
        res.write(data);
        console.log(data.trim());
      });
      
      child.stderr.on('data', (data) => {
        res.write('ERROR: ' + data);
        console.error(data.trim());
      });
      
      child.on('close', (code) => {
        res.end(`\nSync finished with code ${code}`);
      });
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiSyncPlugin()],
})
