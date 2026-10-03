import { createEditor } from '../src/index';
import * as icimgAPI from '../src/index';
const editor = createEditor(document.getElementById('editor')!, {src:'/alpine.jpg',name:'alpine-lake.jpg'});
// Exposed only in the playground, useful for inspecting the package API.
Object.assign(window, {icimg:editor,icimgAPI});
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const examples={
 vanilla:`// Install the downloaded package until npm publication\n// npm install ./icimg-1.0.0.tgz\nimport { createEditor } from 'icimg';\n\nconst editor = createEditor(\n  document.querySelector('#editor'),\n  { src: '/photo.jpg', name: 'photo.jpg' }\n);\nawait editor.ready;\n\n// Or load a File from your own upload control\nawait editor.load(file);\nconst blob = await editor.export({ type: 'image/png' });\n\n// When your view unmounts\neditor.destroy();`,
 react:`import { useEffect, useRef } from 'react';\nimport { createEditor } from 'icimg';\n\nexport function PhotoEditor({ src }) {\n  const host = useRef(null);\n  const instance = useRef(null);\n  useEffect(() => {\n    instance.current = createEditor(host.current);\n    return () => instance.current.destroy();\n  }, []);\n  useEffect(() => {\n    instance.current.load(src).catch(console.error);\n  }, [src]);\n  return <div ref={host} />;\n}`,
 vue:`<script setup>\nimport { ref, onMounted, onBeforeUnmount, watch } from 'vue';\nimport { createEditor } from 'icimg';\nconst props = defineProps({ src: String });\nconst host = ref(null);\nlet editor;\nonMounted(() => {\n  editor = createEditor(host.value);\n  editor.load(props.src).catch(console.error);\n});\nwatch(() => props.src, src => {\n  editor?.load(src).catch(console.error);\n});\nonBeforeUnmount(() => editor?.destroy());\n<\/script>\n<template><div ref="host" /></template>`,
 api:`// UI + framework-agnostic engine\neditor.engine.adjust({ exposure: 15, warmth: 20 });\neditor.engine.rotate(90);\neditor.engine.crop({ x: .1, y: .1, width: .8, height: .8 });\neditor.engine.preset('Mono');\neditor.engine.undo();\neditor.engine.redo();\neditor.engine.reset();\n\nawait editor.export({\n  type: 'image/webp', quality: .92, width: 1600\n});\n\n// DOM events: icimg:load, icimg:change, icimg:export\n// Custom element (explicit, safe for SSR imports):\nimport { defineCustomElement } from 'icimg';\ndefineCustomElement();\n// <ic-image-editor src="/photo.jpg" />`
};
let tab:keyof typeof examples='vanilla';
function showDocs(){ $('docs-code').textContent=examples[tab];$<HTMLDialogElement>('docs-dialog').showModal();}
$('docs-link').addEventListener('click',showDocs);
$('sample-button').addEventListener('click',()=>editor.load('/alpine.jpg','alpine-lake.jpg').catch(console.error));
$('install-button').addEventListener('click',showDocs);
$('shortcuts-button').addEventListener('click',()=>$<HTMLDialogElement>('shortcuts-dialog').showModal());
document.querySelectorAll<HTMLButtonElement>('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')?.close()));
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.tab as keyof typeof examples;$('docs-code').textContent=examples[tab];document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('selected',el===button));}));
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(examples[tab]);$('site-toast').textContent='Example copied. Make something beautiful.';$('site-toast').hidden=false;setTimeout(()=>$('site-toast').hidden=true,2500);}catch{$('site-toast').textContent='Select and copy the code above.';$('site-toast').hidden=false;setTimeout(()=>$('site-toast').hidden=true,2500);}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$<HTMLDialogElement>('shortcuts-dialog').showModal();}});
void editor.ready.catch(error=>console.error(error));
