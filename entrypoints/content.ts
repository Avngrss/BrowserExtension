import { runContentScript } from '@/src/capture/run-content-script';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main() {
    runContentScript();
  },
});
