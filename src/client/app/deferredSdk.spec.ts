import { describe, expect, it, vi } from 'vitest';
import * as module from './yandexSdk';
import type { IYandexSdk } from './IYandexSdk';
describe('nonblocking SDK bridge', () => {
 it('starts immediately and forwards ready and pause subscriptions when SDK arrives', async () => {
  expect(module).toHaveProperty('deferYandexSdk');
  let resolve!: (sdk: IYandexSdk) => void;
  const pending = new Promise<IYandexSdk>(r => { resolve = r; });
  const sdk = module.deferYandexSdk(pending);
  const ready = vi.fn(), pause = vi.fn(), onPause = vi.fn(), onClose = vi.fn();
  sdk.ready(); sdk.onPause(pause); sdk.showFullscreenAdv({onClose});
  expect(onClose).toHaveBeenCalledWith(false);
  resolve({isStub:false,ready,onPause,onResume:vi.fn(),showFullscreenAdv:vi.fn()});
  await pending; await Promise.resolve();
  expect(ready).toHaveBeenCalledTimes(1); expect(onPause).toHaveBeenCalledWith(pause);
  expect(sdk.isStub).toBe(false);
 });
});
