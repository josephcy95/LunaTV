/** @jest-environment node */
import { searchStream } from '@/lib/search-stream';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mockStream(text: string, bytewise = false) {
  const bytes = new TextEncoder().encode(text);
  const cancel = jest.fn();
  global.fetch = jest.fn().mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          if (bytewise)
            bytes.forEach((byte) => controller.enqueue(new Uint8Array([byte])));
          else controller.enqueue(bytes);
          controller.close();
        },
        cancel,
      }),
    ),
  );
  return cancel;
}

async function collect() {
  const result = [];
  for await (const chunk of searchStream('/search')) result.push(chunk);
  return result;
}

const complete = { type: 'complete', completedSources: 1, failedSources: 0 };

test('handles CRLF and multibyte UTF-8 split across every byte', async () => {
  mockStream(
    ': heartbeat\r\n\r\ndata: {"type":"source_error","source":"one","sourceName":"来源","error":"失败"}\r\n\r\ndata: ' +
      JSON.stringify(complete) +
      '\r\n\r\n',
    true,
  );
  expect(await collect()).toEqual([
    { type: 'source_error', source: 'one', sourceName: '来源', error: '失败' },
    complete,
  ]);
});

test('preserves partial delivery but rejects premature EOF', async () => {
  mockStream('data: {"type":"start","totalSources":1}\n\n');
  const stream = searchStream('/search');
  expect((await stream.next()).value).toEqual({
    type: 'start',
    totalSources: 1,
  });
  await expect(stream.next()).rejects.toThrow('搜索连接中断');
});

test.each([
  'not-json',
  'null',
  '{"type":"source_result","results":null}',
  '{"type":"complete","completedSources":-1,"failedSources":0}',
])('rejects malformed event %s', async (data) => {
  mockStream(`data: ${data}\n\ndata: ${JSON.stringify(complete)}\n\n`);
  await expect(collect()).rejects.toThrow('无效数据');
});

test('ignores unknown event types and comments', async () => {
  mockStream(
    ': heartbeat\n\ndata: {"type":"future_event"}\n\ndata: ' +
      JSON.stringify(complete) +
      '\n\n',
  );
  expect(await collect()).toEqual([complete]);
});

test('rejects HTTP errors rather than completing an empty search', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response('Unauthorized', { status: 401 }));
  await expect(collect()).rejects.toThrow('401');
});

test('passes cancellation to fetch and cancels reader on early consumer exit', async () => {
  const cancel = jest.fn();
  global.fetch = jest.fn().mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"start","totalSources":1}\n\n',
            ),
          );
        },
        cancel,
      }),
    ),
  );
  const controller = new AbortController();
  const stream = searchStream('/search', controller.signal);
  await stream.next();
  await stream.return(undefined);
  expect(global.fetch).toHaveBeenCalledWith(
    '/search',
    expect.objectContaining({ signal: controller.signal }),
  );
  expect(cancel).toHaveBeenCalledTimes(1);
});
