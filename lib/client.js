/**
 * people-ai — client half (hand-written module bundle).
 *
 * Paints the fixed wallpaper behind the whole app shell AND locks the
 * appearance to the dark theme while the plugin is loaded:
 *
 * Wallpaper:
 *   1. inserts one <style> element that sets the root background image,
 *      sourced from the same-origin route /people-ai/wallpaper.jpg (host half);
 *   2. overrides the theme tokens to semi-transparent tints so the wallpaper
 *      shows through without hurting readability:
 *      - --dsw-alias-bg-base → translucent surface (the main area keeps a
 *        base tint, the image glows through),
 *      - --dsw-specific-sidebar-fill → slightly translucent sidebar,
 *      while raised surfaces (--dsw-alias-bg-layer-*) stay opaque and readable.
 *
 * Dark lock:
 *   3. forces theme.setTheme('dark') on load,
 *   4. listens on theme/change and bounces any non-dark preference back to
 *      dark (covers every switch path: the settings row, external writes,
 *      other plugins),
 *   5. shadows the official Appearance row (settings.general.item, id
 *      "appearance", priority -1) with a read-only "locked" row, so the
 *      built-in light/system/dark switcher is disabled in the UI.
 *   On unload the original preference is restored and the official row
 *   reappears (slot shadow + listener are fiber-owned).
 *
 * No hash class names, no product DOM selectors, no portal: the style tag is
 * owned by the plugin fiber and removed when the plugin unloads.
 */
window.__ModuleLoader__.load({
  id: 'people-ai',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var react = require('react');

    // ── styles ─────────────────────────────────────────────────────────────
    const css = [
      // Root-level background: the wallpaper fills the canvas behind the app.
      'html,body{background-color:#0f1115;background-image:url("/people-ai/wallpaper.jpg");background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed}',
      // Locked Appearance row: matches the settings row geometry, read-only.
      '.people-ai-appearance-locked{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px}',
      '.people-ai-appearance-locked-title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}',
      '.people-ai-appearance-locked-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);padding:3px 10px;white-space:nowrap}',
      // Composer card frosted glass: translucent tint + backdrop blur over the
      // wallpaper (targets the official stable data-composer-card hook, not a
      // hash class name).
      '[data-composer-card]{background:rgba(15,17,21,0.2)!important;-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px)}',
      // Settings panel frosted glass: the settings dialog is the role=dialog
      // element containing the official data-slot="settings.section" content
      // seat — :has() keeps other dialogs untouched. A 1px theme-border ring
      // (box-shadow 0 0 0 1px, follows the 24px radius, no layout shift) plus a
      // strengthened drop shadow keep the panel edge readable against the
      // wallpaper; tune the ring token / shadow alphas here.
      '[role="dialog"]:has([data-slot="settings.section"]){background:rgba(15,17,21,0.42)!important;-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);box-shadow:0 0 0 1px var(--dsw-alias-border-l3),0 0 1px 0 rgba(0,0,0,0.2),0 4px 12px 0 rgba(0,0,0,0.12),0 12px 32px 0 rgba(0,0,0,0.28)!important}',
      // Cards & buttons inside the settings panel share the panel's frosted
      // material: same translucent fill, 1px theme ring, and drop shadow.
      // Cards = the top-level card lists (ul > li: plugins / models / agent
      // presets); buttons = nav cells, tabs, row & footer actions. The
      // product's own hover/active fills are overridden, so hover feedback is
      // restored with a brightness lift and the selected state re-applied
      // through the stable a11y hooks (aria-current nav rows, data-active
      // tabs). If any primary action button must keep its brand fill, add it
      // to the :not() list below.
      '[role="dialog"]:has([data-slot="settings.section"]) ul:not(li > ul) > li,[role="dialog"]:has([data-slot="settings.section"]) button{background:rgba(15,17,21,0.42)!important;-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);box-shadow:0 0 0 1px var(--dsw-alias-border-l3),0 0 1px 0 rgba(0,0,0,0.2),0 4px 12px 0 rgba(0,0,0,0.12),0 12px 32px 0 rgba(0,0,0,0.28)!important}',
      '[role="dialog"]:has([data-slot="settings.section"]) button:hover{filter:brightness(1.18)}',
      '[role="dialog"]:has([data-slot="settings.section"]) button[aria-current="true"],[role="dialog"]:has([data-slot="settings.section"]) button[data-active="true"]{background:rgba(15,17,21,0.66)!important;box-shadow:0 0 0 1px var(--dsw-alias-border-l4),0 0 1px 0 rgba(0,0,0,0.2),0 4px 12px 0 rgba(0,0,0,0.14),0 12px 32px 0 rgba(0,0,0,0.32)!important}',
    ].join('\n');
    const tagId = 'people-ai/styles.css';
    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const selector = 'style[data-plugin-css="' + tagId + '"]';
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'people-ai';
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    // ── locked Appearance row ──────────────────────────────────────────────
    function LockedAppearanceRow() {
      return react.createElement(
        'div',
        { className: 'people-ai-appearance-locked' },
        react.createElement('span', { className: 'people-ai-appearance-locked-title' }, '外观'),
        react.createElement('span', { className: 'people-ai-appearance-locked-note' }, '深色主题（由 people-ai 锁定）'),
      );
    }

    // ── hero headline rebrand ──────────────────────────────────────────────
    // The new-session hero headline ("探索未至之境" / "Into the Unknown") is a
    // locale dictionary entry the client cannot patch (re-registering the same
    // namespace throws) and has no slot seat, so we rebrand it by exact text
    // matching in the DOM. Text-match based: no hash class names, no product
    // selectors. A MutationObserver handles only changed/added nodes (no full
    // re-scans, safe under streaming output); unload restores the originals.
    const HERO_HEADLINE_REPLACEMENTS = [
      ['探索未至之境', '人民的AI'],
      ['Into the Unknown', '人民的AI'],
    ];
    const REBRANDED_TEXT = '人民的AI';
    const replacedTextNodes = [];
    let heroObserver = null;
    function findAndReplaceText(root) {
      if (root.nodeType === 3) {
        for (const [from, to] of HERO_HEADLINE_REPLACEMENTS) {
          if (root.nodeValue === from) {
            root.nodeValue = to;
            replacedTextNodes.push({ node: root, from });
          }
        }
        return;
      }
      const childNodes = root.childNodes;
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.nodeType === 3) {
          for (const [from, to] of HERO_HEADLINE_REPLACEMENTS) {
            if (child.nodeValue === from) {
              child.nodeValue = to;
              replacedTextNodes.push({ node: child, from });
            }
          }
        } else if (child.nodeType === 1) {
          findAndReplaceText(child);
        }
      }
    }
    function installHeroRebrand() {
      if (typeof document === 'undefined') return () => {};
      // Observe the document root: body may not be ready at bundle load time.
      const root = document.body ?? document.documentElement;
      if (root === null) return () => {};
      findAndReplaceText(root);
      if (typeof MutationObserver === 'undefined') return () => {};
      heroObserver = new MutationObserver((records) => {
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          if (record.type === 'characterData') {
            findAndReplaceText(record.target);
          } else {
            const added = record.addedNodes;
            for (let j = 0; j < added.length; j++) findAndReplaceText(added[j]);
          }
        }
      });
      heroObserver.observe(root, { childList: true, subtree: true, characterData: true });
      return () => {
        if (heroObserver !== null) {
          heroObserver.disconnect();
          heroObserver = null;
        }
        for (let i = 0; i < replacedTextNodes.length; i++) {
          const { node, from } = replacedTextNodes[i];
          if (node.nodeValue === REBRANDED_TEXT) node.nodeValue = from;
        }
        replacedTextNodes.length = 0;
      };
    }

    // ── plugin body ────────────────────────────────────────────────────────
    const inject = ['theme', 'slots'];
    function apply(ctx) {
      ctx.effect(installStyles, 'people-ai: styles');
      ctx.effect(installHeroRebrand, 'people-ai: hero headline rebrand');

      // Dark lock: remember the previous preference, force dark now, bounce
      // every non-dark change back, and restore the previous preference on
      // unload (disposer order: unlisten first, then restore).
      ctx.effect(() => {
        const previous = ctx.theme.getTheme().preference;
        const bounce = (snapshot) => {
          if (snapshot.preference !== 'dark') ctx.theme.setTheme('dark');
        };
        const off = ctx.on('theme/change', bounce);
        ctx.theme.setTheme('dark');
        return () => {
          off();
          ctx.theme.setTheme(previous);
        };
      }, 'people-ai: force dark theme');

      // Semi-transparent tints: the wallpaper glows through the main surface
      // and the sidebar while text stays readable. Tune the alpha values here.
      ctx.theme.overrideTokens('people-ai', {
        '--dsw-alias-bg-base': {
          light: 'rgba(249, 250, 251, 0.45)',
          dark: 'rgba(15, 17, 21, 0.45)',
        },
        '--dsw-specific-sidebar-fill': {
          light: 'rgba(250, 250, 252, 0.5)',
          dark: 'rgba(24, 26, 32, 0.5)',
        },
      });

      // Shadow the official Appearance row with a read-only locked row
      // (same id, lower priority wins; restored automatically on unload).
      ctx.slots.inject('settings.general.item', () => ctx.slots.register(
        { name: 'settings.general.item', id: 'appearance', order: 10, priority: -1 },
        LockedAppearanceRow,
      ));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
