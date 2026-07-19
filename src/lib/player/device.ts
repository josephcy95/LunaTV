/**
 * 播放器共用的设备/浏览器检测。
 *
 * 播放页此前在组件体内每次渲染都重新做 UA 嗅探，并且部分表达式没有
 * SSR 守卫（直接读 window）。这里统一成一个带缓存、SSR 安全的工具。
 */

export interface PlayerDeviceInfo {
  userAgent: string;
  /** iPhone / iPad / iPod（不含 iPadOS 13+ 桌面 UA） */
  isIOS: boolean;
  /** iOS 13+（含伪装成 Mac 的 iPadOS） */
  isIOS13: boolean;
  /** 手机 / 平板等移动设备 */
  isMobile: boolean;
  isSafari: boolean;
  /** 真正的 Chrome（排除国产壳浏览器 / Edge / Opera），用于 Chromecast 判断 */
  isChrome: boolean;
}

const SERVER_FALLBACK: PlayerDeviceInfo = {
  userAgent: '',
  isIOS: false,
  isIOS13: false,
  isMobile: false,
  isSafari: false,
  isChrome: false,
};

let cached: PlayerDeviceInfo | null = null;

export function getPlayerDeviceInfo(): PlayerDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return SERVER_FALLBACK;
  }
  if (cached) return cached;

  const userAgent = navigator.userAgent || '';

  const isIOS =
    /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
  const isIOS13 =
    isIOS ||
    (userAgent.includes('Macintosh') && (navigator.maxTouchPoints ?? 0) >= 1);
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    ) || isIOS13;
  const isSafari = /^(?:(?!chrome|android).)*safari/i.test(userAgent);
  const isChrome =
    /Chrome/i.test(userAgent) &&
    !/Edg|OPR|SamsungBrowser|OPPO|OppoBrowser|HeyTapBrowser|OnePlus|Xiaomi|MIUI|Huawei|Vivo|UCBrowser|QQBrowser|Baidu|SogouMobileBrowser/i.test(
      userAgent
    );

  cached = { userAgent, isIOS, isIOS13, isMobile, isSafari, isChrome };
  return cached;
}
