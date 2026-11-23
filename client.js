window.__ModuleLoader__.load({
  id: 'dsh-desktop-restart',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    var primitives = null
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    } catch (e) {
      primitives = null
    }

    var NS = 'desktop-restart'
    var ROUTE = 'api/dsh-desktop-restart'

    var DICT = {
      en: {
        'button.label': 'Restart app',
        confirm: 'Restart the whole desktop app now? The window will close and reopen.',
        fail: 'Restart failed: {reason}',
        'settings.nav': 'Restart',
        'settings.heading': 'Restart desktop app',
        'settings.intro':
          'Quickly restart the entire DeepSeek Harness desktop app. The restart entry lives in the sidebar panel “More” menu; you can hide it here.',
        'settings.menu': 'Show “Restart app” in the panel More menu',
        'settings.menuHint': 'A “Restart app” row inside the sidebar panel list’s More menu.',
        'settings.restartNow': 'Restart now',
        'settings.ready': 'Ready. The app executable is {exe}.',
        'settings.unavailable':
          'Restart is only available inside the desktop app. This session is running in a web or headless host, so the restart entry is disabled.',
        'settings.error': 'Last error: {msg}',
      },
      zh: {
        'button.label': '重启应用',
        confirm: '现在重启整个桌面版应用吗？窗口会关闭并重新打开。',
        fail: '重启失败：{reason}',
        'settings.nav': '重启应用',
        'settings.heading': '重启桌面版',
        'settings.intro':
          '一键重启整个 DeepSeek Harness 桌面版。重启入口位于侧边栏面板的「更多」菜单中，可在此隐藏。',
        'settings.menu': '在面板「更多」菜单中显示「重启应用」',
        'settings.menuHint': '在侧边栏全局面板列表的「更多」菜单中显示「重启应用」一项。',
        'settings.restartNow': '立即重启',
        'settings.ready': '已就绪，应用可执行文件为 {exe}。',
        'settings.unavailable':
          '重启仅在桌面版应用中可用。当前运行在网页版或无界面宿主中，因此重启入口已禁用。',
        'settings.error': '最近一次错误：{msg}',
      },
    }

    var translate = null
    function t(key, vars) {
      if (typeof translate !== 'function') return key
      return translate(key, vars)
    }

    var CSS = `
.dsrMenuIcon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px}
.dsrMenuRow{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:calc(100% - 8px);min-height:32px;margin:0 4px;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.dsrMenuRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsrMenuRow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsrMenuLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsrIcon{display:inline-flex;flex:none;align-items:center;justify-content:center}
.dsrPage{box-sizing:border-box;display:flex;flex-direction:column;gap:18px;padding:4px 2px 8px;max-width:640px;color:var(--dsw-alias-label-primary);font-size:14px}
.dsrPage h2{margin:0 0 6px;font-size:16px;font-weight:600}
.dsrCard{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:2px 14px}
.dsrRow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0}
.dsrRowText{min-width:0}
.dsrRowText strong{display:block;font-size:14px;line-height:1.4}
.dsrRowText span{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dsrSwitch{box-sizing:border-box;position:relative;flex:0 0 auto;width:38px;height:22px;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-3);cursor:pointer;transition:background .16s,border-color .16s}
.dsrSwitch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .16s,background .16s}
.dsrSwitch[aria-checked="true"]{background:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dsrSwitch[aria-checked="true"]::after{transform:translateX(16px);background:#fff}
.dsrSwitch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsrSwitch:disabled{opacity:.5;cursor:default}
.dsrNotice{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0}
.dsrNotice.isWarn{color:var(--dsw-alias-state-warn-label,#946200)}
.dsrPrimary{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 16px;border:0;border-radius:9px;background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:14px;font-weight:500;cursor:pointer}
.dsrPrimary:hover:not(:disabled){filter:brightness(1.05)}
.dsrPrimary:disabled{opacity:.55;cursor:default}
.dsrPrimary.isDanger{background:var(--dsw-alias-state-error-primary,#c0392b)}
`

    function transport(input, init) {
      var tb = typeof window !== 'undefined' ? window.__DSH_TRANSPORT__ : null
      if (tb && typeof tb.fetch === 'function') return tb.fetch(input, init)
      return fetch(input, init)
    }

    function api(action, payload) {
      var init
      if (action) {
        init = {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.assign({ action: action }, payload || {})),
        }
      } else {
        init = { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } }
      }
      return transport(ROUTE, init).then(function (res) {
        if (!res || !res.ok) throw new Error('http ' + (res && res.status))
        return res.json()
      })
    }

    function confirmRestart() {
      try {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          return window.confirm(t('confirm')) !== false
        }
      } catch (e) {}
      return true
    }

    function notifyError(message) {
      try {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(message)
          return
        }
      } catch (e) {}
      try {
        console.error('[dsh-desktop-restart]', message)
      } catch (e) {}
    }

    function doRestart(setBusy) {
      if (!confirmRestart()) return
      if (setBusy) setBusy(true)
      api('restart')
        .then(function (r) {
          if (!r || !r.ok) {
            notifyError(t('fail', { reason: (r && (r.reason || r.error || r.message)) || '' }))
            if (setBusy) setBusy(false)
          }
        })
        .catch(function (e) {
          notifyError(t('fail', { reason: String((e && e.message) || e) }))
          if (setBusy) setBusy(false)
        })
    }

    function detectDesktop() {
      if (typeof window === 'undefined') return false
      return !!(window.dshDesktop || window.dshDesktopBoot || window.__DSH_HOST_PATHS__)
    }

    var store = {
      state: {
        loaded: false,
        loading: false,
        settings: { showInPanelMenu: true },
        available: detectDesktop(),
        reason: null,
        exeName: null,
        error: null,
      },
      listeners: new Set(),
      subscribe: function (fn) {
        this.listeners.add(fn)
        var self = this
        return function () {
          self.listeners.delete(fn)
        }
      },
      emit: function () {
        this.listeners.forEach(function (fn) {
          try {
            fn()
          } catch (e) {}
        })
      },
      patch: function (partial) {
        this.state = Object.assign({}, this.state, partial)
        this.emit()
      },
      load: function () {
        if (this.state.loading || this.state.loaded) return
        this.patch({ loading: true })
        return api(null)
          .then((r) => {
            this.patch({
              loaded: true,
              loading: false,
              settings: r.settings || this.state.settings,
              available: !!r.available || detectDesktop(),
              reason: r.reason || null,
              exeName: r.exeName || null,
              error: null,
            })
          })
          .catch((e) => {
            this.patch({ loaded: true, loading: false, error: String((e && e.message) || e) })
          })
      },
      save: function (settings) {
        var prev = this.state.settings
        this.patch({ settings: settings })
        return api('setSettings', { settings: settings })
          .then((r) => {
            if (r && r.settings) this.patch({ settings: r.settings, error: null })
            return true
          })
          .catch((e) => {
            this.patch({ settings: prev, error: String((e && e.message) || e) })
            return false
          })
      },
    }

    function useStore() {
      var force = React.useReducer(function (x) {
        return x + 1
      }, 0)[1]
      React.useEffect(function () {
        store.load()
        return store.subscribe(force)
      }, [])
      return store.state
    }

    function RestartIcon(props) {
      var size = props && props.size ? props.size : 16
      return h(
        'svg',
        {
          className: 'dsrIcon',
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { key: 'a', d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        h('path', { key: 'b', d: 'M21 3v6h-6' }),
      )
    }

    function menuIcon() {
      return h('span', { className: 'dsrMenuIcon', 'aria-hidden': 'true' }, h(RestartIcon, { size: 16 }))
    }

    function menuRowFallback(onSelect) {
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dsrMenuRow',
          onClick: onSelect,
        },
        menuIcon(),
        h('span', { className: 'dsrMenuLabel' }, t('button.label')),
      )
    }

    class MenuRowBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch() {}
      render() {
        if (this.state.failed) return this.props.fallback
        return this.props.children
      }
    }

    function PanelMenuItem(props) {
      var state = useStore()
      if (!state.settings.showInPanelMenu) return null
      var dismiss = props && typeof props.onDismiss === 'function' ? props.onDismiss : function () {}
      var onSelect = function () {
        dismiss()
        doRestart(null)
      }
      if (primitives && typeof primitives.MenuItemButton === 'function') {
        var row = h(
          primitives.MenuItemButton,
          { icon: menuIcon(), onSelect: onSelect },
          t('button.label'),
        )
        return h(MenuRowBoundary, { fallback: menuRowFallback(onSelect) }, row)
      }
      return menuRowFallback(onSelect)
    }

    function SettingsPage() {
      var state = useStore()
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      function toggle(key) {
        var next = Object.assign({}, state.settings)
        next[key] = !next[key]
        store.save(next)
      }
      return h(
        'div',
        { className: 'dsrPage' },
        h(
          'div',
          null,
          h('h2', null, t('settings.heading')),
          h('p', { className: 'dsrNotice' }, t('settings.intro')),
        ),
        h(
          'div',
          { className: 'dsrCard' },
          h(
            'div',
            { className: 'dsrRow' },
            h(
              'div',
              { className: 'dsrRowText' },
              h('strong', null, t('settings.menu')),
              h('span', null, t('settings.menuHint')),
            ),
            h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': state.settings.showInPanelMenu ? 'true' : 'false',
              'aria-label': t('settings.menu'),
              className: 'dsrSwitch',
              disabled: !state.loaded,
              onClick: function () {
                toggle('showInPanelMenu')
              },
            }),
          ),
        ),
        h(
          'div',
          null,
          h(
            'button',
            {
              type: 'button',
              className: 'dsrPrimary isDanger',
              'aria-busy': busy ? 'true' : 'false',
              disabled: busy || !state.available,
              onClick: function () {
                doRestart(setBusy)
              },
            },
            h(RestartIcon, { size: 16 }),
            h('span', null, t('settings.restartNow')),
          ),
          state.available
            ? h('p', { className: 'dsrNotice', style: { marginTop: '10px' } }, t('settings.ready', { exe: state.exeName || '' }))
            : h('p', { className: 'dsrNotice isWarn', style: { marginTop: '10px' } }, t('settings.unavailable')),
        ),
        state.error ? h('p', { className: 'dsrNotice isWarn' }, t('settings.error', { msg: state.error })) : null,
      )
    }

    var restartIconComponent = function (props) {
      return h(RestartIcon, { size: (props && props.size) || 16 })
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICT), 'desktop-restart: dictionaries')
      translate = ctx.locale.bind(NS)

      ctx.effect(function () {
        var id = 'dsh-desktop-restart-css'
        if (typeof document === 'undefined') return undefined
        var el = document.querySelector('style[data-plugin-css="' + id + '"]')
        if (!el) {
          el = document.createElement('style')
          el.setAttribute('data-plugin', 'dsh-desktop-restart')
          el.setAttribute('data-plugin-css', id)
          el.textContent = CSS
          document.head.appendChild(el)
          return function () {
            el.remove()
          }
        }
        return undefined
      }, 'desktop-restart: styles')

      ctx.slots.inject('sidebar.panellist.actions', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist.actions',
            id: 'desktop-restart-menu',
            order: 10,
            label: function () {
              return t('button.label')
            },
            locale: NS,
          },
          PanelMenuItem,
        )
      })

      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          {
            name: 'settings.section',
            id: 'desktop-restart',
            order: 60,
            label: function () {
              return t('settings.nav')
            },
            locale: NS,
          },
          SettingsPage,
        )
      })

      ctx.slots.inject('settings.section.icon', function () {
        return ctx.slots.register(
          {
            name: 'settings.section.icon',
            id: 'desktop-restart',
            order: 60,
            label: function () {
              return t('settings.nav')
            },
            locale: NS,
          },
          restartIconComponent,
        )
      })
    }

    module.exports = { inject: ['slots', 'locale'], apply: apply }
    return module.exports
  },
})
