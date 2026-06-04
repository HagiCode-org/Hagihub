import { useEffect, useState } from 'react';
import type { AppInfo } from '../shared/api';

const repoUrl = 'https://github.com/HagiCode-org/Hagihub';

function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    document.getElementById('loading-container')?.remove();

    window.hagihub.getAppInfo().then((info) => {
      setAppInfo(info);
    }).catch((error) => {
      console.error('Failed to load app info:', error);
    });
  }, []);

  return (
    <main className="shell">
      <section className="hero surface">
        <div className="hero-copy">
          <p className="eyebrow">HagiCode Hub</p>
          <h1>Hagihub</h1>
          <p className="hero-text">
            HagiCode 生态系统的桌面端入口。基于 Electron 构建，为后续功能扩展提供基础框架。
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void window.hagihub.openExternal(repoUrl)}
            >
              打开仓库
            </button>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-stat">
            <span>运行模式</span>
            <strong>{appInfo ? `${appInfo.buildChannel} / packaged=${String(appInfo.isPackaged)}` : '加载中'}</strong>
          </div>
          <div className="hero-stat">
            <span>平台</span>
            <strong>{appInfo?.platform || '加载中'}</strong>
          </div>
          <div className="hero-stat">
            <span>版本</span>
            <strong>{appInfo ? `v${appInfo.appVersion} / Electron ${appInfo.electronVersion}` : '加载中'}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="surface section-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">About</p>
              <h2>项目信息</h2>
            </div>
          </div>
          <dl className="info-grid">
            <div className="info-item">
              <dt>应用名称</dt>
              <dd>{appInfo?.appName || '加载中'}</dd>
            </div>
            <div className="info-item">
              <dt>应用版本</dt>
              <dd>{appInfo?.appVersion || '加载中'}</dd>
            </div>
            <div className="info-item">
              <dt>Electron</dt>
              <dd>{appInfo?.electronVersion || '加载中'}</dd>
            </div>
            <div className="info-item">
              <dt>Chrome</dt>
              <dd>{appInfo?.chromeVersion || '加载中'}</dd>
            </div>
            <div className="info-item">
              <dt>Node.js</dt>
              <dd>{appInfo?.nodeVersion || '加载中'}</dd>
            </div>
            <div className="info-item">
              <dt>平台</dt>
              <dd>{appInfo?.platform || '加载中'}</dd>
            </div>
          </dl>
        </article>

        <article className="surface section-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Status</p>
              <h2>运行状态</h2>
            </div>
          </div>
          <div className="status-grid">
            <div className="status-item">
              <span className={`status-dot ${appInfo?.buildChannel === 'development' ? 'dev' : 'prod'}`} />
              <span>{appInfo?.buildChannel === 'development' ? '开发模式' : '生产模式'}</span>
            </div>
            <div className="status-item">
              <span className={`status-dot ${appInfo?.isPackaged ? 'packaged' : 'unpackaged'}`} />
              <span>{appInfo?.isPackaged ? '已打包' : '未打包'}</span>
            </div>
          </div>
          <p className="hint-block">
            当前为 Electron 基础框架，后续将逐步添加 Hub 功能模块。
          </p>
        </article>
      </section>
    </main>
  );
}

export default App;
