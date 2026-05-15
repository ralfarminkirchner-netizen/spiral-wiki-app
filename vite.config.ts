import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const runSync = () => {
  return {
    name: 'run-sync',
    buildStart() {
      console.log('--- AUTO-RUNNING SYNC SCRIPTS (Fixing missing names and photos) ---');
      try {
        console.log(execSync('node scripts/fetch-wiki-images.js', { encoding: 'utf-8' }));
        console.log(execSync('node scripts/build-wiki-data.js', { encoding: 'utf-8' }));
        console.log('--- SYNC COMPLETE ---');
      } catch (err) {
        console.error('Failed to sync data:', err);
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), runSync()],
})
