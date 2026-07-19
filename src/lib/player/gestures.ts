/**
 * 播放器手势层（对齐主流视频网站的交互习惯）。
 *
 * 触屏：
 * - 单击：显示 / 隐藏控制栏
 * - 双击中间：播放 / 暂停
 * - 双击左右侧：快退 / 快进 10 秒（连续点按可累加，同 YouTube）
 * - 长按：临时 2 倍速，松开恢复
 *
 * 鼠标：
 * - 单击：播放 / 暂停（预留 250ms 判断是否双击）
 * - 双击：切换全屏
 * - 按住不放：临时 2 倍速，松开恢复
 *
 * 所有被本层消费的交互都会在捕获阶段拦截 click/dblclick，
 * 避免与 ArtPlayer 内建的点击行为叠加（历史上双重 toggle 的来源）。
 */

export interface PlayerGestureCallbacks {
  /** 每次调用时读取最新的播放器实例（避免闭包持有旧实例） */
  getArt: () => any | null;
  seekBy: (seconds: number) => void;
  togglePlay: () => void;
  toggleFullscreen: () => void;
  startFastForward: () => void;
  stopFastForward: () => void;
  /** 命中播放器控制栏 / 设置面板等 UI 时跳过手势处理 */
  isChromeTarget: (target: EventTarget | null) => boolean;
}

const SEEK_STEP_SECONDS = 10;
const TAP_MAX_DURATION = 300;
const DOUBLE_TAP_WINDOW = 300;
const DOUBLE_TAP_RADIUS = 64;
const MOVE_CANCEL_THRESHOLD = 10;
const LONG_PRESS_DELAY = 500;
const CLICK_SUPPRESS_WINDOW = 400;
/** 双击跳转后，继续单击可在该窗口内连续累加跳转 */
const SEEK_STREAK_WINDOW = 800;

type TapZone = 'left' | 'center' | 'right';

interface LastTap {
  time: number;
  x: number;
  y: number;
  zone: TapZone;
}

export function attachPlayerGestures(
  container: HTMLElement,
  cb: PlayerGestureCallbacks
): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let moved = false;
  let isTouchLike = false;

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressActive = false;

  let singleTapTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTap: LastTap | null = null;

  let suppressClicksUntil = 0;

  let seekStreakZone: TapZone | null = null;
  let seekStreakTotal = 0;
  let seekStreakDeadline = 0;

  // ---------------------------------------------------------------------------
  // 视觉反馈层（快进/快退波纹 + 倍速角标），指针事件穿透。
  // 必须挂在 ArtPlayer 的 $player 元素内：原生全屏 / 网页全屏时才能跟随显示。
  // 播放器重建会连带销毁旧层，这里按需在当前 $player 里查找或创建。
  // ---------------------------------------------------------------------------
  let rippleHideTimer: ReturnType<typeof setTimeout> | null = null;

  const getLayer = (): HTMLElement | null => {
    const art = cb.getArt();
    const playerEl: HTMLElement | undefined = art?.template?.$player;
    if (!playerEl) return null;
    let layer = playerEl.querySelector<HTMLElement>(':scope > .art-gesture-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'art-gesture-layer';
      playerEl.appendChild(layer);
    }
    return layer;
  };

  const showSeekRipple = (zone: 'left' | 'right', totalSeconds: number) => {
    const layer = getLayer();
    if (!layer) return;
    let rippleEl = layer.querySelector<HTMLElement>('.art-gesture-ripple');
    if (!rippleEl) {
      rippleEl = document.createElement('div');
      layer.appendChild(rippleEl);
    }
    rippleEl.className = `art-gesture-ripple art-gesture-ripple-${zone}`;
    rippleEl.innerHTML = `
      <span class="art-gesture-ripple-arrows">${
        zone === 'left' ? '&#9664;&#9664;' : '&#9654;&#9654;'
      }</span>
      <span class="art-gesture-ripple-label">${totalSeconds} 秒</span>
    `;
    // 重启动画
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    rippleEl.offsetWidth;
    rippleEl.classList.add('art-gesture-ripple-active');
    if (rippleHideTimer) clearTimeout(rippleHideTimer);
    rippleHideTimer = setTimeout(() => {
      rippleEl?.classList.remove('art-gesture-ripple-active');
    }, 600);
  };

  const showSpeedBadge = () => {
    const layer = getLayer();
    if (!layer) return;
    let speedBadgeEl = layer.querySelector<HTMLElement>('.art-gesture-speed');
    if (!speedBadgeEl) {
      speedBadgeEl = document.createElement('div');
      speedBadgeEl.className = 'art-gesture-speed';
      speedBadgeEl.innerHTML =
        '2x <span class="art-gesture-speed-arrows">&#9654;&#9654;</span>';
      layer.appendChild(speedBadgeEl);
    }
    speedBadgeEl.classList.add('art-gesture-speed-active');
  };

  const hideSpeedBadge = () => {
    const art = cb.getArt();
    const badge: HTMLElement | null | undefined =
      art?.template?.$player?.querySelector('.art-gesture-speed');
    badge?.classList.remove('art-gesture-speed-active');
  };

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------
  const zoneForX = (clientX: number): TapZone => {
    const rect = container.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    if (ratio <= 0.35) return 'left';
    if (ratio >= 0.65) return 'right';
    return 'center';
  };

  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const clearSingleTapTimer = () => {
    if (singleTapTimer) {
      clearTimeout(singleTapTimer);
      singleTapTimer = null;
    }
  };

  const stopFastForwardIfActive = () => {
    if (longPressActive) {
      longPressActive = false;
      hideSpeedBadge();
      cb.stopFastForward();
    }
  };

  const suppressUpcomingClicks = () => {
    suppressClicksUntil = Date.now() + CLICK_SUPPRESS_WINDOW;
  };

  const performSeek = (zone: 'left' | 'right') => {
    const now = Date.now();
    if (seekStreakZone === zone && now <= seekStreakDeadline) {
      seekStreakTotal += SEEK_STEP_SECONDS;
    } else {
      seekStreakZone = zone;
      seekStreakTotal = SEEK_STEP_SECONDS;
    }
    seekStreakDeadline = now + SEEK_STREAK_WINDOW;
    cb.seekBy(zone === 'left' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
    showSeekRipple(zone, seekStreakTotal);
  };

  const isSeekStreakActive = (zone: TapZone): zone is 'left' | 'right' =>
    zone !== 'center' &&
    seekStreakZone === zone &&
    Date.now() <= seekStreakDeadline;

  const toggleControlsVisibility = () => {
    const art = cb.getArt();
    if (!art?.controls) return;
    art.controls.show = !art.controls.show;
  };

  // ---------------------------------------------------------------------------
  // 指针事件
  // ---------------------------------------------------------------------------
  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (cb.isChromeTarget(event.target)) {
      pointerId = null;
      clearLongPressTimer();
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startTime = Date.now();
    moved = false;
    isTouchLike = event.pointerType !== 'mouse';
    longPressActive = false;

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      longPressActive = true;
      clearSingleTapTimer();
      showSpeedBadge();
      cb.startFastForward();
    }, LONG_PRESS_DELAY);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (
      Math.abs(event.clientX - startX) > MOVE_CANCEL_THRESHOLD ||
      Math.abs(event.clientY - startY) > MOVE_CANCEL_THRESHOLD
    ) {
      moved = true;
      clearLongPressTimer();
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (cb.isChromeTarget(event.target)) {
      clearLongPressTimer();
      stopFastForwardIfActive();
      pointerId = null;
      return;
    }
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    clearLongPressTimer();

    // 长按结束：恢复速度，吞掉本次点击
    if (longPressActive) {
      stopFastForwardIfActive();
      suppressUpcomingClicks();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const tapDuration = Date.now() - startTime;
    if (moved || tapDuration >= TAP_MAX_DURATION) return;

    const zone = zoneForX(event.clientX);
    const now = Date.now();
    suppressUpcomingClicks();
    event.preventDefault();
    event.stopPropagation();

    // 设置面板打开时，点视频区域＝关闭面板（不触发播放/暂停等动作）
    const art = cb.getArt();
    if (art?.setting?.show) {
      art.setting.show = false;
      lastTap = null;
      return;
    }

    if (isTouchLike) {
      // 连续快进 / 快退：跳转窗口内的单击直接累加
      if (isSeekStreakActive(zone)) {
        clearSingleTapTimer();
        lastTap = null;
        performSeek(zone);
        return;
      }

      const isDoubleTap =
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_WINDOW &&
        Math.abs(lastTap.x - event.clientX) <= DOUBLE_TAP_RADIUS &&
        Math.abs(lastTap.y - event.clientY) <= DOUBLE_TAP_RADIUS;

      if (isDoubleTap) {
        clearSingleTapTimer();
        lastTap = null;
        if (zone === 'center') {
          cb.togglePlay();
        } else {
          performSeek(zone);
        }
        return;
      }

      lastTap = { time: now, x: event.clientX, y: event.clientY, zone };
      clearSingleTapTimer();
      singleTapTimer = setTimeout(() => {
        singleTapTimer = null;
        lastTap = null;
        toggleControlsVisibility();
      }, DOUBLE_TAP_WINDOW);
      return;
    }

    // 鼠标：单击播放/暂停（延迟以区分双击全屏）
    const isDoubleClick = lastTap && now - lastTap.time <= DOUBLE_TAP_WINDOW;
    if (isDoubleClick) {
      clearSingleTapTimer();
      lastTap = null;
      cb.toggleFullscreen();
      return;
    }

    lastTap = { time: now, x: event.clientX, y: event.clientY, zone };
    clearSingleTapTimer();
    singleTapTimer = setTimeout(() => {
      singleTapTimer = null;
      lastTap = null;
      cb.togglePlay();
    }, 250);
  };

  const handlePointerCancel = () => {
    pointerId = null;
    clearLongPressTimer();
    stopFastForwardIfActive();
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (cb.isChromeTarget(event.target)) return;
    if (Date.now() <= suppressClicksUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleDoubleClickCapture = (event: MouseEvent) => {
    if (cb.isChromeTarget(event.target)) return;
    // 双击行为完全由本层接管（触屏跳转 / 鼠标全屏）
    event.preventDefault();
    event.stopPropagation();
  };

  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerup', handlePointerUp);
  container.addEventListener('pointercancel', handlePointerCancel);
  container.addEventListener('pointerleave', handlePointerCancel);
  container.addEventListener('click', handleClickCapture, true);
  container.addEventListener('dblclick', handleDoubleClickCapture, true);

  return () => {
    clearLongPressTimer();
    clearSingleTapTimer();
    if (rippleHideTimer) clearTimeout(rippleHideTimer);
    stopFastForwardIfActive();
    container.removeEventListener('pointerdown', handlePointerDown);
    container.removeEventListener('pointermove', handlePointerMove);
    container.removeEventListener('pointerup', handlePointerUp);
    container.removeEventListener('pointercancel', handlePointerCancel);
    container.removeEventListener('pointerleave', handlePointerCancel);
    container.removeEventListener('click', handleClickCapture, true);
    container.removeEventListener('dblclick', handleDoubleClickCapture, true);
    // 反馈层挂在 $player 内，播放器销毁时会随之移除；这里兜底清理
    container
      .querySelectorAll('.art-gesture-layer')
      .forEach((el) => el.remove());
  };
}
