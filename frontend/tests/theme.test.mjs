import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import postcss from 'postcss';

const css=await readFile(new URL('../src/styles/global.css',import.meta.url),'utf8');
const tokens=Object.fromEntries([...css.matchAll(/--([a-z]+-(?:00|100|200|300)):\s*(#[0-9a-f]{6})/gi)].map(m=>[m[1],m[2].toUpperCase()]));
const theme=await readFile(new URL('../src/styles/platform-theme.css',import.meta.url),'utf8');
const surfaces=await readFile(new URL('../src/styles/theme-surfaces.css',import.meta.url),'utf8');
test('theme colors only reference the original template palette and all rules exclude the chatbot',()=>{
 assert.equal(tokens['primary-00'],'#2C151A');assert.equal(tokens['secondary-100'],'#659774');assert.equal(tokens['tertiary-300'],'#585068');
 const allowed=new Set(Object.values(tokens));for(const m of theme.matchAll(/#[0-9a-f]{6}\b/gi))assert(allowed.has(m[0].toUpperCase()),m[0]);
 for(const text of [theme,surfaces])postcss.parse(text).walkRules(rule=>assert(rule.selector.includes(':not(:has(.esham-chatbot))'),rule.selector));
 postcss.parse(surfaces).walkDecls(d=>assert(/^(color|background|border|outline|box-shadow|text-shadow|accent-color)/.test(d.prop),d.prop));
 assert(!surfaces.includes('--var('));assert(!surfaces.includes('esham-light-wordmark'));
});
function luminance(hex){const v=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function contrast(a,b){const x=luminance(tokens[a]),y=luminance(tokens[b]);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('cream text and controls meet AA on every semantic burgundy surface',()=>{
 for(const bg of ['primary-00','primary-200','primary-300']){assert(contrast('white-300',bg)>=4.5);assert(contrast('white-00',bg)>=4.5);assert(contrast('white-300',bg)>=3);}
 for(const bg of ['secondary-300','tertiary-300'])assert(contrast('white-00',bg)>=4.5);
 assert(contrast('black-300','white-00')>=4.5);
 assert(contrast('primary-100','primary-00')>=3);assert(contrast('secondary-100','primary-00')>=3);
});
test('actual logo assets switch with theme; chatbot navigation retains its original asset and treatment',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-theme-tests',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 const previous=globalThis.localStorage;
 try{const [{default:Logo},{PreferencesProvider}]=await Promise.all(['/src/components/ThemeLogo.jsx','/src/context/PreferencesContext.jsx'].map(p=>server.ssrLoadModule(p)));
 for(const mode of ['light','dark']){globalThis.localStorage={getItem:k=>k==='esham-theme'?mode:'en'};
 const render=route=>renderToStaticMarkup(h(MemoryRouter,{initialEntries:[route]},h(PreferencesProvider,null,h(Logo,{alt:'Esham'}))));
 const page=render('/admin');assert(page.includes(mode==='dark'?'logo2.png':'esham-logo.png'));assert(page.includes('data-esham-logo'));assert(!page.includes('filter'));
 const chat=render('/learner/assistant');assert(chat.includes('esham-logo.png'));assert(!chat.includes('logo2'));assert(!chat.includes('data-esham-logo'));}
 }finally{globalThis.localStorage=previous;await server.close();}
});
