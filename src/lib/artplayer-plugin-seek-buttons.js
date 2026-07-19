/**
 * ArtPlayer 快进/快退按钮插件
 * 桌面端（>=768px）：在控制栏添加按钮
 * 移动端（<768px）：在播放器上叠加悬浮按钮（跟随控制栏显隐）
 *
 * 修复记录（相对旧版）：
 * - 样式只注入一次（此前每次创建播放器都会累积一个 <style> 标签）
 * - 布局标记挂在播放器根元素上而不是 body（此前 body 属性永不清理，
 *   且 `.art-fullscreen body ...` 这类选择器永远不可能匹配，全屏样式全部失效）
 * - 全屏尺寸调整选择器改为真实可匹配的写法
 * - 布局重建后按可见性判断补上了锁定状态（art.isLock）
 * - duration 无效（NaN/0，直播或元数据未就绪）时快进不再产生 NaN
 */

const STYLE_ELEMENT_ID = 'artplayer-plugin-seek-buttons-style';

const SEEK_BUTTON_STYLES = `
  .art-seek-floating-left,
  .art-seek-floating-right {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 20;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease;
    color: white;
    padding: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  }

  /* 双侧模式：屏幕中部左右两个圆形按钮（Netflix 风格） */
  .art-video-player[data-seek-layout='both'] .art-seek-floating-left,
  .art-video-player[data-seek-layout='both'] .art-seek-floating-right {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }

  .art-video-player[data-seek-layout='both'] .art-seek-floating-left {
    left: 50%;
    transform: translate(-100%, -50%);
    margin-left: -40px;
  }

  .art-video-player[data-seek-layout='both'] .art-seek-floating-right {
    right: 50%;
    transform: translate(100%, -50%);
    margin-right: -40px;
  }

  .art-video-player[data-seek-layout='both'] .art-seek-floating-left:active {
    transform: translate(-100%, -50%) scale(0.92);
  }

  .art-video-player[data-seek-layout='both'] .art-seek-floating-right:active {
    transform: translate(100%, -50%) scale(0.92);
  }

  /* 单侧模式：屏幕边缘竖向胶囊按钮（上半快退 / 下半快进） */
  .art-video-player[data-seek-layout='left'] .art-seek-floating-left,
  .art-video-player[data-seek-layout='right'] .art-seek-floating-right {
    width: 64px;
    height: 110px;
    border-radius: 32px;
  }

  .art-video-player[data-seek-layout='left'] .art-seek-floating-left {
    left: 16px;
    top: 35%; /* 向上移动避开锁定按钮 */
  }

  .art-video-player[data-seek-layout='right'] .art-seek-floating-right {
    right: 16px;
  }

  .art-video-player[data-seek-layout='left'] .art-seek-floating-left:active,
  .art-video-player[data-seek-layout='right'] .art-seek-floating-right:active {
    transform: translateY(-50%) scale(0.92);
    background: rgba(255, 255, 255, 0.25);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  /* 全屏（原生 / 网页）：加大按钮与间距 */
  .art-video-player.art-fullscreen[data-seek-layout='both'] .art-seek-floating-left,
  .art-video-player.art-fullscreen-web[data-seek-layout='both'] .art-seek-floating-left {
    margin-left: -60px;
  }

  .art-video-player.art-fullscreen[data-seek-layout='both'] .art-seek-floating-right,
  .art-video-player.art-fullscreen-web[data-seek-layout='both'] .art-seek-floating-right {
    margin-right: -60px;
  }

  .art-video-player.art-fullscreen[data-seek-layout='both'] .art-seek-floating-left,
  .art-video-player.art-fullscreen[data-seek-layout='both'] .art-seek-floating-right,
  .art-video-player.art-fullscreen-web[data-seek-layout='both'] .art-seek-floating-left,
  .art-video-player.art-fullscreen-web[data-seek-layout='both'] .art-seek-floating-right {
    width: 72px;
    height: 72px;
    padding: 16px;
  }

  .art-video-player.art-fullscreen[data-seek-layout='left'] .art-seek-floating-left,
  .art-video-player.art-fullscreen-web[data-seek-layout='left'] .art-seek-floating-left {
    left: 24px;
    top: 35%;
  }

  .art-video-player.art-fullscreen[data-seek-layout='right'] .art-seek-floating-right,
  .art-video-player.art-fullscreen-web[data-seek-layout='right'] .art-seek-floating-right {
    right: 24px;
  }

  .art-video-player.art-fullscreen[data-seek-layout='left'] .art-seek-floating-left,
  .art-video-player.art-fullscreen[data-seek-layout='right'] .art-seek-floating-right,
  .art-video-player.art-fullscreen-web[data-seek-layout='left'] .art-seek-floating-left,
  .art-video-player.art-fullscreen-web[data-seek-layout='right'] .art-seek-floating-right {
    width: 72px;
    height: 128px;
    padding: 16px;
  }
`;

function ensureStylesInjected() {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = SEEK_BUTTON_STYLES;
  document.head.appendChild(style);
}

export default function artplayerPluginSeekButtons(option = {}) {
  return (art) => {
    let currentSeekTime = option.seekTime || 10;
    let currentMobileLayout = option.mobileLayout || 'both';

    // 检测屏幕宽度（仅在插件安装时判定一次；本应用在换源/换集时会重建播放器）
    const isSmallScreen = () => window.innerWidth < 768;

    const backwardIconPath = 'M16 4c6.627 0 12 5.373 12 12s-5.373 12-12 12S4 22.627 4 16h2.5c0 5.247 4.253 9.5 9.5 9.5s9.5-4.253 9.5-9.5S21.247 6.5 16 6.5c-2.858 0-5.42 1.265-7.176 3.265L12 13H4V5l2.94 2.94C9.303 5.39 12.453 4 16 4z';
    const forwardIconPath = 'M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12h-2.5c0 5.247-4.253 9.5-9.5 9.5S6.5 21.247 6.5 16 10.753 6.5 16 6.5c2.858 0 5.42 1.265 7.176 3.265L20 13h8V5l-2.94 2.94C22.697 5.39 19.547 4 16 4z';

    const generateSeekIcon = (path, time) => `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <path d="${path}" fill="currentColor"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${time}</text>
      </svg>
    `;

    const generateBackwardIcon = (time) => generateSeekIcon(backwardIconPath, time);
    const generateForwardIcon = (time) => generateSeekIcon(forwardIconPath, time);

    const generateDualSeekIcon = (time) => `
      <svg viewBox="0 0 32 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
        <g transform="translate(0, 2) scale(0.65)">
          <path d="${backwardIconPath}" fill="currentColor"/>
          <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${time}</text>
        </g>
        <g transform="translate(0, 30) scale(0.65)">
          <path d="${forwardIconPath}" fill="currentColor"/>
          <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor" font-family="Arial, sans-serif">${time}</text>
        </g>
      </svg>
    `;

    const setCurrentTime = (time) => {
      art.currentTime = time;
      if (art.video) {
        art.video.currentTime = time;
      }
    };

    const keepControlsVisible = () => {
      if (art.controls) {
        art.controls.show = true;
      }
    };

    const seekBackward = () => {
      const current = Number(art.currentTime) || 0;
      const newTime = Math.max(0, current - currentSeekTime);
      setCurrentTime(newTime);
      keepControlsVisible();
      art.notice.show = `⏪ 后退 ${currentSeekTime} 秒`;
    };

    const seekForward = () => {
      const current = Number(art.currentTime) || 0;
      const duration = Number(art.duration);
      const target = current + currentSeekTime;
      const newTime =
        Number.isFinite(duration) && duration > 0
          ? Math.min(duration, target)
          : target;
      setCurrentTime(newTime);
      keepControlsVisible();
      art.notice.show = `⏩ 前进 ${currentSeekTime} 秒`;
    };

    // 创建移动端悬浮按钮（初建与布局重建共用）
    const createFloatingButton = (side, isSingleButton) => {
      const button = document.createElement('div');
      button.className = `art-seek-floating-${side}`;

      if (isSingleButton) {
        // 单侧模式：双向箭头，上半快退、下半快进
        button.innerHTML = generateDualSeekIcon(currentSeekTime);
        button.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = button.getBoundingClientRect();
          const isTopHalf = e.clientY - rect.top < rect.height / 2;
          if (isTopHalf) {
            seekBackward();
          } else {
            seekForward();
          }
        };
      } else {
        button.innerHTML =
          side === 'left'
            ? generateBackwardIcon(currentSeekTime)
            : generateForwardIcon(currentSeekTime);
        button.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (side === 'left') {
            seekBackward();
          } else {
            seekForward();
          }
        };
      }

      return button;
    };

    const mountFloatingButtons = () => {
      art.template.$player.setAttribute('data-seek-layout', currentMobileLayout);
      if (currentMobileLayout === 'both') {
        art.template.$player.appendChild(createFloatingButton('left', false));
        art.template.$player.appendChild(createFloatingButton('right', false));
      } else {
        art.template.$player.appendChild(
          createFloatingButton(currentMobileLayout, true)
        );
      }
    };

    // 跟随控制栏显隐（锁定时也隐藏）
    const updateButtonsVisibility = () => {
      const controlsVisible = art.controls.show && !art.isLock;
      const allButtons = art.template.$player.querySelectorAll(
        '.art-seek-floating-left, .art-seek-floating-right'
      );
      allButtons.forEach((button) => {
        if (controlsVisible) {
          button.style.opacity = '0.85';
          button.style.pointerEvents = 'auto';
        } else {
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
        }
      });
    };

    if (isSmallScreen()) {
      ensureStylesInjected();

      art.on('ready', () => {
        mountFloatingButtons();
        art.on('control', updateButtonsVisibility);
        art.on('lock', updateButtonsVisibility);
        updateButtonsVisibility();
      });
    } else {
      // 大屏幕：添加到控制栏
      const desktopButtonStyle = {
        width: '40px',
        height: '40px',
        padding: '8px',
        opacity: '0.9',
        transition: 'all 0.2s ease',
      };
      const desktopHoverEffect = ($el) => {
        $el.addEventListener('mouseenter', () => {
          $el.style.opacity = '1';
          $el.style.transform = 'scale(1.1)';
        });
        $el.addEventListener('mouseleave', () => {
          $el.style.opacity = '0.9';
          $el.style.transform = 'scale(1)';
        });
      };

      art.controls.add({
        name: 'seek-backward',
        position: 'left',
        html: generateBackwardIcon(currentSeekTime),
        tooltip: `后退 ${currentSeekTime} 秒`,
        style: desktopButtonStyle,
        mounted: desktopHoverEffect,
        click: seekBackward,
      });

      art.controls.add({
        name: 'seek-forward',
        position: 'left',
        html: generateForwardIcon(currentSeekTime),
        tooltip: `前进 ${currentSeekTime} 秒`,
        style: desktopButtonStyle,
        mounted: desktopHoverEffect,
        click: seekForward,
      });
    }

    return {
      name: 'artplayerPluginSeekButtons',
      config: (newOptions) => {
        const oldMobileLayout = currentMobileLayout;

        if (newOptions.seekTime !== undefined) {
          currentSeekTime = newOptions.seekTime;
        }
        if (newOptions.mobileLayout !== undefined) {
          currentMobileLayout = newOptions.mobileLayout;
        }

        if (!isSmallScreen()) {
          // 桌面端：更新按钮图标与提示
          const backwardBtn = art.controls['seek-backward'];
          const forwardBtn = art.controls['seek-forward'];
          if (backwardBtn && forwardBtn) {
            backwardBtn.innerHTML = generateBackwardIcon(currentSeekTime);
            forwardBtn.innerHTML = generateForwardIcon(currentSeekTime);
            backwardBtn.setAttribute('aria-label', `后退 ${currentSeekTime} 秒`);
            forwardBtn.setAttribute('aria-label', `前进 ${currentSeekTime} 秒`);
          }
          return;
        }

        const layoutChanged =
          newOptions.mobileLayout !== undefined &&
          oldMobileLayout !== currentMobileLayout;

        if (layoutChanged) {
          // 布局改变：重建按钮（数量和位置会变）
          art.template.$player
            .querySelectorAll('.art-seek-floating-left, .art-seek-floating-right')
            .forEach((btn) => btn.remove());
          mountFloatingButtons();
          updateButtonsVisibility();
        } else if (newOptions.seekTime !== undefined) {
          // 只是秒数改变：只更新图标，不重建按钮
          const buttons = art.template.$player.querySelectorAll(
            '.art-seek-floating-left, .art-seek-floating-right'
          );
          buttons.forEach((button) => {
            if (currentMobileLayout !== 'both') {
              button.innerHTML = generateDualSeekIcon(currentSeekTime);
            } else if (button.classList.contains('art-seek-floating-left')) {
              button.innerHTML = generateBackwardIcon(currentSeekTime);
            } else {
              button.innerHTML = generateForwardIcon(currentSeekTime);
            }
          });
        }
      },
    };
  };
}
