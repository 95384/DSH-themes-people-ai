import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

test('browser bundle installs wallpaper styles and overrides the base token', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let definition;
  const created = [];
  const context = vm.createContext({
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value;
        },
      },
    },
    document: {
      querySelector() {
        return null;
      },
      createElement(tag) {
        const el = { dataset: {}, textContent: '', remove() {} };
        created.push(el);
        return el;
      },
      head: {
        appendChild() {},
      },
      body: {
        nodeType: 1,
        childNodes: [],
      },
    },
  });
  vm.runInContext(source, context, { filename: 'lib/client.js' });
  assert.equal(definition.id, 'people-ai');

  const React = {
    createElement() {},
  };
  const exported = definition.factory((name) => {
    if (name === 'react') return React;
    throw new Error('Unexpected browser dependency: ' + name);
  });

  // ── mocks ────────────────────────────────────────────────────────────────
  const themeCalls = [];
  const changeListeners = [];
  const slotInjections = [];
  const effects = [];
  let registeredTokens;
  const previousPreference = 'light';
  const ctx = {
    effect(factory) {
      const disposer = factory();
      effects.push(disposer);
      return disposer;
    },
    on(name, listener) {
      if (name !== 'theme/change') throw new Error('Unexpected event: ' + name);
      changeListeners.push(listener);
      return () => {};
    },
    theme: {
      getTheme() {
        return { preference: previousPreference, revision: 0 };
      },
      setTheme(id) {
        themeCalls.push(id);
      },
      overrideTokens(source, tokens) {
        registeredTokens = { source, tokens };
        return () => {};
      },
    },
    slots: {
      inject(name, factory) {
        slotInjections.push({ name, registration: factory() });
      },
      register(options, component) {
        return { options, component };
      },
    },
  };
  exported.apply(ctx);

  // ── style tag ────────────────────────────────────────────────────────────
  assert.equal(created.length, 1);
  assert.equal(created[0].dataset.plugin, 'people-ai');
  assert.equal(created[0].dataset.pluginCss, 'people-ai/styles.css');
  assert.match(created[0].textContent, /url\("\/people-ai\/wallpaper\.jpg"\)/);
  // Frosted-glass composer: translucent tint + backdrop blur via the stable hook.
  assert.match(created[0].textContent, /\[data-composer-card\]/);
  assert.match(created[0].textContent, /backdrop-filter:blur\(1px\)/);
  // Frosted-glass settings panel: dialog containing the settings.section seat.
  assert.match(created[0].textContent, /\[role="dialog"\]:has\(\[data-slot="settings\.section"\]\)/);
  // Cards & buttons inside the panel share the frosted material (same fill,
  // ring, and shadow as the panel itself); the selected state is re-applied
  // via the stable a11y hooks.
  assert.match(created[0].textContent, /\[role="dialog"\]:has\(\[data-slot="settings\.section"\]\) ul:not\(li > ul\) > li/);
  assert.match(created[0].textContent, /button\[aria-current="true"\]/);
  assert.match(created[0].textContent, /button\[data-active="true"\]/);
  // Tabs are text-only; card-interior buttons, card surfaces, and inputs
  // inside the panel are transparent.
  assert.match(created[0].textContent, /button\[role="tab"\]\{background:transparent/);
  assert.match(created[0].textContent, /ul:not\(li > ul\) > li button\{background:transparent/);
  assert.match(created[0].textContent, /ul:not\(li > ul\) > li\{background:transparent/);
  assert.match(created[0].textContent, /input:not\(\[type="checkbox"\]\)/);

  // ── token overrides ──────────────────────────────────────────────────────
  assert.deepEqual([...exported.inject], ['theme', 'slots']);
  assert.equal(registeredTokens.source, 'people-ai');
  assert.equal(registeredTokens.tokens['--dsw-alias-bg-base'].light, 'rgba(249, 250, 251, 0.45)');
  assert.equal(registeredTokens.tokens['--dsw-alias-bg-base'].dark, 'rgba(15, 17, 21, 0.45)');
  assert.equal(registeredTokens.tokens['--dsw-specific-sidebar-fill'].light, 'rgba(250, 250, 252, 0.5)');
  assert.equal(registeredTokens.tokens['--dsw-specific-sidebar-fill'].dark, 'rgba(24, 26, 32, 0.5)');

  // ── dark lock: forced on load ────────────────────────────────────────────
  assert.ok(themeCalls.includes('dark'), 'setTheme("dark") must be called on load');

  // ── dark lock: bounces every non-dark change back ────────────────────────
  const bounce = changeListeners[0];
  assert.equal(typeof bounce, 'function');
  const before = themeCalls.length;
  bounce({ preference: 'light' });
  bounce({ preference: 'system' });
  assert.equal(themeCalls.length, before + 2, 'non-dark changes must bounce back to dark');
  bounce({ preference: 'dark' });
  assert.equal(themeCalls.length, before + 2, 'dark changes must not bounce');

  // ── Appearance row shadow: same id, lower priority, read-only component ──
  const appearance = slotInjections.find((entry) => entry.name === 'settings.general.item');
  assert.ok(appearance, 'must inject into settings.general.item');
  assert.equal(appearance.registration.options.id, 'appearance');
  assert.equal(appearance.registration.options.order, 10);
  assert.equal(appearance.registration.options.priority, -1);

  // ── unload: restore the previous preference ──────────────────────────────
  const beforeUnload = themeCalls.length;
  effects[2]();
  assert.equal(themeCalls[themeCalls.length - 1], previousPreference, 'unload must restore the previous preference');
  assert.ok(themeCalls.length >= beforeUnload + 1);
});

test('hero headline rebrand replaces and restores the headline text', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let definition;
  const textNode = { nodeType: 3, nodeValue: '探索未至之境' };
  const container = { nodeType: 1, childNodes: [textNode] };
  const context = vm.createContext({
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value;
        },
      },
    },
    document: {
      body: { nodeType: 1, childNodes: [container] },
      querySelector() {
        return null;
      },
      createElement() {
        return { dataset: {}, textContent: '', remove() {} };
      },
      head: {
        appendChild() {},
      },
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {}
      disconnect() {}
    },
  });
  vm.runInContext(source, context, { filename: 'lib/client.js' });
  const React = {
    createElement() {},
  };
  const exported = definition.factory((name) => {
    if (name === 'react') return React;
    throw new Error('Unexpected browser dependency: ' + name);
  });
  const effects = [];
  const ctx = {
    effect(factory) {
      const disposer = factory();
      effects.push(disposer);
      return disposer;
    },
    on() {
      return () => {};
    },
    theme: {
      getTheme() {
        return { preference: 'dark' };
      },
      setTheme() {},
      overrideTokens() {
        return () => {};
      },
    },
    slots: {
      inject() {},
      register() {
        return {};
      },
    },
  };
  exported.apply(ctx);

  // Initial scan replaces the exact headline text.
  assert.equal(textNode.nodeValue, '人民的AI');
  // Unload restores the original headline.
  effects[1]();
  assert.equal(textNode.nodeValue, '探索未至之境');
});
