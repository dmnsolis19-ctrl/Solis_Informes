// Loaded before the stylesheet to apply the saved appearance before first paint.
(()=>{
 const modes=['system','light','dark'],key='solis-theme-mode',media=window.matchMedia('(prefers-color-scheme: dark)');
 let mode='system';try{const saved=localStorage.getItem(key);if(modes.includes(saved))mode=saved;}catch{}
 function apply(){const resolved=mode==='system'?(media.matches?'dark':'light'):mode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#111e29':'#102f40');document.querySelectorAll('[data-theme-select]').forEach(select=>select.value=mode);}
 window.SolisTheme={get:()=>mode,set(value){if(!modes.includes(value))return;mode=value;try{localStorage.setItem(key,mode);}catch{}apply();},sync:apply};
 media.addEventListener('change',()=>{if(mode==='system')apply();});window.addEventListener('storage',event=>{if(event.key===key){mode=modes.includes(event.newValue)?event.newValue:'system';apply();}});
 document.addEventListener('change',event=>{if(event.target.matches('[data-theme-select]'))window.SolisTheme.set(event.target.value);});apply();
})();
