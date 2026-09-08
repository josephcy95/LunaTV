/** @jest-environment node */
import { isPrivateOrLocalApiUrl } from '@/lib/private-api-url';

test.each([
  'http://192.168.1.138:8788/api.php/provide/vod/',
  'http://10.0.0.5/api.php/provide/vod/',
  'http://172.16.4.2:8080/api.php/provide/vod/',
  'http://127.0.0.1:3000/api.php/provide/vod/',
  'http://localhost:8788/api.php/provide/vod/',
  'http://100.64.12.34:8788/api.php/provide/vod/',
  'http://nas.local/api.php/provide/vod/',
  'http://media.ts.net/api.php/provide/vod/',
  'http://host.docker.internal:8788/api.php/provide/vod/',
])('skips Cloudflare proxy for %s', (url) => {
  expect(isPrivateOrLocalApiUrl(url)).toBe(true);
});

test.each([
  'https://iqiyizyapi.com/api.php/provide/vod/',
  'https://caiji.example.com/api.php/provide/vod/',
])('still proxies public APIs like %s', (url) => {
  expect(isPrivateOrLocalApiUrl(url)).toBe(false);
});
