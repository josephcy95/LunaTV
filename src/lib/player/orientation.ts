/**
 * 移动端全屏自动横屏。
 *
 * 进入原生全屏时，如果是移动设备且视频为横向画幅，尝试调用
 * screen.orientation.lock('landscape') 将屏幕锁定为横屏；退出全屏时解锁。
 *
 * 兼容性说明：
 * - Android Chrome/Edge/微信等：支持 orientation.lock，但必须已处于全屏，
 *   因此监听 ArtPlayer 的 'fullscreen' 事件（此时全屏已生效）。
 * - iPhone Safari：不支持元素全屏，ArtPlayer 会退化为 video 原生全屏
 *   （webkitEnterFullscreen），系统播放器自身支持转屏，无需处理。
 * - 网页全屏（fullscreenWeb）不是真全屏，无法锁定方向，由 ArtPlayer 的
 *   autoOrientation 选项负责 CSS 旋转适配。
 * - 竖屏视频（如短剧）画幅为纵向时不锁横屏，保持自然方向。
 */

import { getPlayerDeviceInfo } from './device';

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

interface LockableScreenOrientation {
  lock?: (orientation: OrientationLockType) => Promise<void>;
  unlock?: () => void;
}

function getScreenOrientation(): LockableScreenOrientation | null {
  if (typeof screen === 'undefined') return null;
  return (screen.orientation as unknown as LockableScreenOrientation) ?? null;
}

function isLandscapeVideo(video: HTMLVideoElement | null | undefined): boolean {
  // 元数据未就绪时默认按横向处理（绝大多数影视内容为横向）
  if (!video || !video.videoWidth || !video.videoHeight) return true;
  return video.videoWidth >= video.videoHeight;
}

async function lockLandscape(video: HTMLVideoElement | null | undefined) {
  const orientation = getScreenOrientation();
  if (!orientation?.lock) return;
  if (!isLandscapeVideo(video)) return;
  try {
    await orientation.lock('landscape');
  } catch {
    // 部分浏览器（iOS Safari、桌面端）会拒绝，忽略即可
  }
}

function unlockOrientation() {
  try {
    getScreenOrientation()?.unlock?.();
  } catch {
    // ignore
  }
}

/**
 * 给 ArtPlayer 实例挂载「全屏自动横屏」行为，返回解绑函数。
 */
export function attachFullscreenOrientation(art: any): () => void {
  const { isMobile } = getPlayerDeviceInfo();
  if (!isMobile) {
    return () => undefined;
  }

  const onFullscreen = (active: boolean) => {
    if (active) {
      void lockLandscape(art?.video as HTMLVideoElement | undefined);
    } else {
      unlockOrientation();
    }
  };

  const onDestroy = () => {
    unlockOrientation();
  };

  art.on('fullscreen', onFullscreen);
  art.on('destroy', onDestroy);

  return () => {
    try {
      art.off('fullscreen', onFullscreen);
      art.off('destroy', onDestroy);
    } catch {
      // 实例可能已销毁
    }
    unlockOrientation();
  };
}
