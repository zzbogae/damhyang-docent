var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},c=(n,r,o)=>(o=n==null?{}:e(i(n)),s(r||!n||!n.__esModule||!a.call(n,`default`)?t(o,`default`,{value:n,enumerable:!0}):o,n)),l=(e=>typeof require<`u`?require:typeof Proxy<`u`?new Proxy(e,{get:(e,t)=>(typeof require<`u`?require:e)[t]}):e)(function(e){if(typeof require<`u`)return require.apply(this,arguments);throw Error('Calling `require` for "'+e+"\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.")});
/**
* @license
* Copyright 2019 Google LLC
* SPDX-License-Identifier: Apache-2.0
*/
const u=Symbol(`Comlink.proxy`),d=Symbol(`Comlink.endpoint`),ee=Symbol(`Comlink.releaseProxy`),f=Symbol(`Comlink.finalizer`),p=Symbol(`Comlink.thrown`),te=e=>typeof e==`object`&&!!e||typeof e==`function`,m=new Map([[`proxy`,{canHandle:e=>te(e)&&e[u],serialize(e){let{port1:t,port2:n}=new MessageChannel;return h(e,t),[n,[n]]},deserialize(e){return e.start(),ie(e)}}],[`throw`,{canHandle:e=>te(e)&&p in e,serialize({value:e}){let t;return t=e instanceof Error?{isError:!0,value:{message:e.message,name:e.name,stack:e.stack}}:{isError:!1,value:e},[t,[]]},deserialize(e){throw e.isError?Object.assign(Error(e.value.message),e.value):e.value}}]]);function ne(e,t){for(let n of e)if(t===n||n===`*`||n instanceof RegExp&&n.test(t))return!0;return!1}function h(e,t=globalThis,n=[`*`]){t.addEventListener(`message`,function r(i){if(!i||!i.data)return;if(!ne(n,i.origin)){console.warn(`Invalid origin '${i.origin}' for comlink proxy`);return}let{id:a,type:o,path:s}=Object.assign({path:[]},i.data),c=(i.data.argumentList||[]).map(w),l;try{let t=s.slice(0,-1).reduce((e,t)=>e[t],e),n=s.reduce((e,t)=>e[t],e);switch(o){case`GET`:l=n;break;case`SET`:t[s.slice(-1)[0]]=w(i.data.value),l=!0;break;case`APPLY`:l=n.apply(t,c);break;case`CONSTRUCT`:l=ue(new n(...c));break;case`ENDPOINT`:{let{port1:t,port2:n}=new MessageChannel;h(e,n),l=le(t,[t])}break;case`RELEASE`:l=void 0;break;default:return}}catch(e){l={value:e,[p]:0}}Promise.resolve(l).catch(e=>({value:e,[p]:0})).then(n=>{let[i,s]=C(n);t.postMessage(Object.assign(Object.assign({},i),{id:a}),s),o===`RELEASE`&&(t.removeEventListener(`message`,r),g(t),f in e&&typeof e[f]==`function`&&e[f]())}).catch(e=>{let[n,r]=C({value:TypeError(`Unserializable return value`),[p]:0});t.postMessage(Object.assign(Object.assign({},n),{id:a}),r)})}),t.start&&t.start()}function re(e){return e.constructor.name===`MessagePort`}function g(e){re(e)&&e.close()}function ie(e,t){let n=new Map;return e.addEventListener(`message`,function(e){let{data:t}=e;if(!t||!t.id)return;let r=n.get(t.id);if(r)try{r(t)}finally{n.delete(t.id)}}),b(e,n,[],t)}function _(e){if(e)throw Error(`Proxy has been released and is not useable`)}function ae(e){return T(e,new Map,{type:`RELEASE`}).then(()=>{g(e)})}const v=new WeakMap,y=`FinalizationRegistry`in globalThis&&new FinalizationRegistry(e=>{let t=(v.get(e)||0)-1;v.set(e,t),t===0&&ae(e)});function oe(e,t){let n=(v.get(t)||0)+1;v.set(t,n),y&&y.register(e,t,e)}function se(e){y&&y.unregister(e)}function b(e,t,n=[],r=function(){}){let i=!1,a=new Proxy(r,{get(r,o){if(_(i),o===ee)return()=>{se(a),ae(e),t.clear(),i=!0};if(o===`then`){if(n.length===0)return{then:()=>a};let r=T(e,t,{type:`GET`,path:n.map(e=>e.toString())}).then(w);return r.then.bind(r)}return b(e,t,[...n,o])},set(r,a,o){_(i);let[s,c]=C(o);return T(e,t,{type:`SET`,path:[...n,a].map(e=>e.toString()),value:s},c).then(w)},apply(r,a,o){_(i);let s=n[n.length-1];if(s===d)return T(e,t,{type:`ENDPOINT`}).then(w);if(s===`bind`)return b(e,t,n.slice(0,-1));let[c,l]=x(o);return T(e,t,{type:`APPLY`,path:n.map(e=>e.toString()),argumentList:c},l).then(w)},construct(r,a){_(i);let[o,s]=x(a);return T(e,t,{type:`CONSTRUCT`,path:n.map(e=>e.toString()),argumentList:o},s).then(w)}});return oe(a,e),a}function ce(e){return Array.prototype.concat.apply([],e)}function x(e){let t=e.map(C);return[t.map(e=>e[0]),ce(t.map(e=>e[1]))]}const S=new WeakMap;function le(e,t){return S.set(e,t),e}function ue(e){return Object.assign(e,{[u]:!0})}function C(e){for(let[t,n]of m)if(n.canHandle(e)){let[r,i]=n.serialize(e);return[{type:`HANDLER`,name:t,value:r},i]}return[{type:`RAW`,value:e},S.get(e)||[]]}function w(e){switch(e.type){case`HANDLER`:return m.get(e.name).deserialize(e.value);case`RAW`:return e.value}}function T(e,t,n,r){return new Promise(i=>{let a=de();t.set(a,i),e.start&&e.start(),e.postMessage(Object.assign({id:a},n),r)})}function de(){return[,,,,].fill(0).map(()=>Math.floor(Math.random()*(2**53-1)).toString(16)).join(`-`)}var fe=Object.defineProperty,E=(e,t)=>fe(e,`name`,{value:t,configurable:!0}),pe=(e=>typeof l<`u`?l:typeof Proxy<`u`?new Proxy(e,{get:(e,t)=>(typeof l<`u`?l:e)[t]}):e)(function(e){if(typeof l<`u`)return l.apply(this,arguments);throw Error(`Dynamic require of "`+e+`" is not supported`)}),me=(()=>{for(var e=new Uint8Array(128),t=0;t<64;t++)e[t<26?t+65:t<52?t+71:t<62?t-4:t*4-205]=t;return t=>{for(var n=t.length,r=new Uint8Array((n-(t[n-1]==`=`)-(t[n-2]==`=`))*3/4|0),i=0,a=0;i<n;){var o=e[t.charCodeAt(i++)],s=e[t.charCodeAt(i++)],c=e[t.charCodeAt(i++)],l=e[t.charCodeAt(i++)];r[a++]=o<<2|s>>4,r[a++]=s<<4|c>>2,r[a++]=c<<6|l}return r}})();function he(e){return!isNaN(parseFloat(e))&&isFinite(e)}E(he,`_isNumber`);function D(e){return e.charAt(0).toUpperCase()+e.substring(1)}E(D,`_capitalize`);function O(e){return function(){return this[e]}}E(O,`_getter`);var k=[`isConstructor`,`isEval`,`isNative`,`isToplevel`],A=[`columnNumber`,`lineNumber`],j=[`fileName`,`functionName`,`source`],M=k.concat(A,j,[`args`],[`evalOrigin`]);function N(e){if(e)for(var t=0;t<M.length;t++)e[M[t]]!==void 0&&this[`set`+D(M[t])](e[M[t]])}for(E(N,`StackFrame`),N.prototype={getArgs:E(function(){return this.args},`getArgs`),setArgs:E(function(e){if(Object.prototype.toString.call(e)!==`[object Array]`)throw TypeError(`Args must be an Array`);this.args=e},`setArgs`),getEvalOrigin:E(function(){return this.evalOrigin},`getEvalOrigin`),setEvalOrigin:E(function(e){if(e instanceof N)this.evalOrigin=e;else if(e instanceof Object)this.evalOrigin=new N(e);else throw TypeError(`Eval Origin must be an Object or StackFrame`)},`setEvalOrigin`),toString:E(function(){var e=this.getFileName()||``,t=this.getLineNumber()||``,n=this.getColumnNumber()||``,r=this.getFunctionName()||``;return this.getIsEval()?e?`[eval] (`+e+`:`+t+`:`+n+`)`:`[eval]:`+t+`:`+n:r?r+` (`+e+`:`+t+`:`+n+`)`:e+`:`+t+`:`+n},`toString`)},N.fromString=E(function(e){var t=e.indexOf(`(`),n=e.lastIndexOf(`)`),r=e.substring(0,t),i=e.substring(t+1,n).split(`,`),a=e.substring(n+1);if(a.indexOf(`@`)===0)var o=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(a,``),s=o[1],c=o[2],l=o[3];return new N({functionName:r,args:i||void 0,fileName:s,lineNumber:c||void 0,columnNumber:l||void 0})},`StackFrame$$fromString`),P=0;P<k.length;P++)N.prototype[`get`+D(k[P])]=O(k[P]),N.prototype[`set`+D(k[P])]=function(e){return function(t){this[e]=!!t}}(k[P]);var P;for(F=0;F<A.length;F++)N.prototype[`get`+D(A[F])]=O(A[F]),N.prototype[`set`+D(A[F])]=function(e){return function(t){if(!he(t))throw TypeError(e+` must be a Number`);this[e]=Number(t)}}(A[F]);var F;for(I=0;I<j.length;I++)N.prototype[`get`+D(j[I])]=O(j[I]),N.prototype[`set`+D(j[I])]=function(e){return function(t){this[e]=String(t)}}(j[I]);var I,L=N;function R(){var e=/^\s*at .*(\S+:\d+|\(native\))/m,t=/^(eval@)?(\[native code])?$/;return{parse:E(function(t){if(t.stack&&t.stack.match(e))return this.parseV8OrIE(t);if(t.stack)return this.parseFFOrSafari(t);throw Error(`Cannot parse given Error object`)},`ErrorStackParser$$parse`),extractLocation:E(function(e){if(e.indexOf(`:`)===-1)return[e];var t=/(.+?)(?::(\d+))?(?::(\d+))?$/.exec(e.replace(/[()]/g,``));return[t[1],t[2]||void 0,t[3]||void 0]},`ErrorStackParser$$extractLocation`),parseV8OrIE:E(function(t){return t.stack.split(`
`).filter(function(t){return!!t.match(e)},this).map(function(e){e.indexOf(`(eval `)>-1&&(e=e.replace(/eval code/g,`eval`).replace(/(\(eval at [^()]*)|(,.*$)/g,``));var t=e.replace(/^\s+/,``).replace(/\(eval code/g,`(`).replace(/^.*?\s+/,``),n=t.match(/ (\(.+\)$)/);t=n?t.replace(n[0],``):t;var r=this.extractLocation(n?n[1]:t);return new L({functionName:n&&t||void 0,fileName:[`eval`,`<anonymous>`].indexOf(r[0])>-1?void 0:r[0],lineNumber:r[1],columnNumber:r[2],source:e})},this)},`ErrorStackParser$$parseV8OrIE`),parseFFOrSafari:E(function(e){return e.stack.split(`
`).filter(function(e){return!e.match(t)},this).map(function(e){if(e.indexOf(` > eval`)>-1&&(e=e.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,`:$1`)),e.indexOf(`@`)===-1&&e.indexOf(`:`)===-1)return new L({functionName:e});var t=/((.*".+"[^@]*)?[^@]*)(?:@)/,n=e.match(t),r=n&&n[1]?n[1]:void 0,i=this.extractLocation(e.replace(t,``));return new L({functionName:r,fileName:i[0],lineNumber:i[1],columnNumber:i[2],source:e})},this)},`ErrorStackParser$$parseFFOrSafari`)}}E(R,`ErrorStackParser`);var ge=new R;function z(){return typeof API<`u`&&API!==globalThis.API?API.runtimeEnv:V({IN_BUN:typeof Bun<`u`,IN_DENO:typeof Deno<`u`,IN_NODE:typeof process==`object`&&typeof process.versions==`object`&&typeof process.versions.node==`string`&&!process.browser,IN_SAFARI:typeof navigator==`object`&&typeof navigator.userAgent==`string`&&navigator.userAgent.indexOf(`Chrome`)===-1&&navigator.userAgent.indexOf(`Safari`)>-1,IN_SHELL:typeof read==`function`&&typeof load==`function`,IN_WORKERD:typeof navigator==`object`&&navigator.userAgent?.includes(`Cloudflare-Workers`)})}E(z,`getGlobalRuntimeEnv`);var B=z();function V(e){let t=e.IN_NODE&&typeof module<`u`&&module.exports&&typeof pe==`function`&&typeof __dirname==`string`,n=e.IN_NODE&&!t,r=!e.IN_NODE&&!e.IN_DENO&&!e.IN_BUN,i=r&&typeof window<`u`&&typeof window.document<`u`&&typeof document.createElement==`function`&&`sessionStorage`in window&&typeof globalThis.importScripts!=`function`,a=r&&typeof globalThis.WorkerGlobalScope<`u`&&typeof globalThis.self<`u`&&globalThis.self instanceof globalThis.WorkerGlobalScope;if(a&&H())throw Error(`Classic web workers are not supported`);let o={...e,IN_BROWSER:r,IN_BROWSER_MAIN_THREAD:i,IN_BROWSER_WEB_WORKER:a,IN_NODE_COMMONJS:t,IN_NODE_ESM:n};if(!(o.IN_BROWSER_MAIN_THREAD||o.IN_BROWSER_WEB_WORKER||o.IN_NODE||o.IN_SHELL||o.IN_WORKERD))throw Error(`Cannot determine runtime environment: ${JSON.stringify(o)}`);return o}E(V,`calculateDerivedFlags`);function H(){try{return globalThis.importScripts(`data:text/javascript,`),!0}catch{return!1}}E(H,`isClassicWorker`);var U,W,G,K;async function q(){if(!B.IN_NODE||(U=(await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1))).default,G=await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1)),K=await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1)),(await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1))).default,W=await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1)),X=W.sep,typeof pe<`u`))return;let e={fs:G,crypto:await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1)),ws:await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1)),child_process:await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1))};globalThis.require=function(t){return e[t]}}E(q,`initNodeModules`);function J(e,t){return W.resolve(t||`.`,e)}E(J,`node_resolvePath`);function Y(e,t){return t===void 0&&(t=location),new URL(e,t).toString()}E(Y,`browser_resolvePath`);var _e=B.IN_NODE?J:B.IN_SHELL?E(e=>e,`resolvePath`):Y,X;B.IN_NODE||(X=`/`);function ve(e,t){return e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`)?{response:fetch(e)}:{binary:K.readFile(e).then(e=>new Uint8Array(e.buffer,e.byteOffset,e.byteLength))}}E(ve,`node_getBinaryResponse`);function ye(e,t){if(e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`))throw Error(`Shell cannot fetch urls`);return{binary:Promise.resolve(new Uint8Array(readbuffer(e)))}}E(ye,`shell_getBinaryResponse`);function be(e,t){let n=new URL(e,location);return{response:fetch(n,t?{integrity:t}:{})}}E(be,`browser_getBinaryResponse`);var xe=B.IN_NODE?ve:B.IN_SHELL?ye:be;async function Se(e,t){let{response:n,binary:r}=xe(e,t);if(r)return r;let i=await n;if(!i.ok)throw Error(`Failed to load '${e}': request failed.`);return new Uint8Array(await i.arrayBuffer())}E(Se,`loadBinaryFile`);var Ce=B.IN_NODE?we:E(async e=>await import(e),`loadScript`);async function we(e){return e.startsWith(`file://`)&&(e=e.slice(7)),e.includes(`://`)?await import(e):await import(U.pathToFileURL(e).href)}E(we,`nodeLoadScript`);async function Te(e){if(B.IN_NODE){await q();let t=await K.readFile(e,{encoding:`utf8`});return JSON.parse(t)}if(B.IN_SHELL){let t=read(e);return JSON.parse(t)}return await(await fetch(e)).json()}E(Te,`loadLockFile`);async function Ee(){if(B.IN_NODE_COMMONJS)return __dirname;let e;try{throw Error()}catch(t){e=t}let t=ge.parse(e)[0].fileName;if(B.IN_NODE&&!t.startsWith(`file://`)&&(t=`file://${t}`),B.IN_NODE_ESM){let e=await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1));return(await import(`./__vite-browser-external-DBlWSfRe.js`).then(e=>c(e.default,1))).fileURLToPath(e.dirname(t))}let n=t.lastIndexOf(X);if(n===-1)throw Error(`Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.`);return t.slice(0,n)}E(Ee,`calculateDirname`);function De(e){return e.substring(0,e.lastIndexOf(`/`)+1)||globalThis.location?.toString()||`.`}E(De,`calculateInstallBaseUrl`);function Oe(e){let t=e.FS,n=e.FS.filesystems.MEMFS,r=e.PATH,i={DIR_MODE:16895,FILE_MODE:33279,mount:E(function(e){if(!e.opts.fileSystemHandle)throw Error(`opts.fileSystemHandle is required`);return n.mount.apply(null,arguments)},`mount`),syncfs:E(async(e,t,n)=>{try{let r=i.getLocalSet(e),a=await i.getRemoteSet(e),o=t?a:r,s=t?r:a;await i.reconcile(e,o,s),n(null)}catch(e){n(e)}},`syncfs`),getLocalSet:E(e=>{let n=Object.create(null);function i(e){return e!==`.`&&e!==`..`}E(i,`isRealDir`);function a(e){return t=>r.join2(e,t)}E(a,`toAbsolute`);let o=t.readdir(e.mountpoint).filter(i).map(a(e.mountpoint));for(;o.length;){let e=o.pop(),r=t.stat(e);t.isDir(r.mode)&&o.push.apply(o,t.readdir(e).filter(i).map(a(e))),n[e]={timestamp:r.mtime,mode:r.mode}}return{type:`local`,entries:n}},`getLocalSet`),getRemoteSet:E(async e=>{let t=Object.create(null),n=await ke(e.opts.fileSystemHandle);for(let[a,o]of n)a!==`.`&&(t[r.join2(e.mountpoint,a)]={timestamp:o.kind===`file`?new Date((await o.getFile()).lastModified):new Date,mode:o.kind===`file`?i.FILE_MODE:i.DIR_MODE});return{type:`remote`,entries:t,handles:n}},`getRemoteSet`),loadLocalEntry:E(e=>{let r=t.lookupPath(e,{}).node,i=t.stat(e);if(t.isDir(i.mode))return{timestamp:i.mtime,mode:i.mode};if(t.isFile(i.mode))return r.contents=n.getFileDataAsTypedArray(r),{timestamp:i.mtime,mode:i.mode,contents:r.contents};throw Error(`node type not supported`)},`loadLocalEntry`),storeLocalEntry:E((e,n)=>{if(t.isDir(n.mode))t.mkdirTree(e,n.mode);else if(t.isFile(n.mode))t.writeFile(e,n.contents,{canOwn:!0});else throw Error(`node type not supported`);t.chmod(e,n.mode),t.utime(e,n.timestamp,n.timestamp)},`storeLocalEntry`),removeLocalEntry:E(e=>{var n=t.stat(e);t.isDir(n.mode)?t.rmdir(e):t.isFile(n.mode)&&t.unlink(e)},`removeLocalEntry`),loadRemoteEntry:E(async e=>{if(e.kind===`file`){let t=await e.getFile();return{contents:new Uint8Array(await t.arrayBuffer()),mode:i.FILE_MODE,timestamp:new Date(t.lastModified)}}if(e.kind===`directory`)return{mode:i.DIR_MODE,timestamp:new Date};throw Error(`unknown kind: `+e.kind)},`loadRemoteEntry`),storeRemoteEntry:E(async(e,n,i)=>{let a=e.get(r.dirname(n)),o=t.isFile(i.mode)?await a.getFileHandle(r.basename(n),{create:!0}):await a.getDirectoryHandle(r.basename(n),{create:!0});if(o.kind===`file`){let e=await o.createWritable();await e.write(i.contents),await e.close()}e.set(n,o)},`storeRemoteEntry`),removeRemoteEntry:E(async(e,t)=>{await e.get(r.dirname(t)).removeEntry(r.basename(t)),e.delete(t)},`removeRemoteEntry`),reconcile:E(async(e,n,a)=>{let o=0,s=[];Object.keys(n.entries).forEach(function(e){let r=n.entries[e],i=a.entries[e];(!i||t.isFile(r.mode)&&r.timestamp.getTime()>i.timestamp.getTime())&&(s.push(e),o++)}),s.sort();let c=[];if(Object.keys(a.entries).forEach(function(e){n.entries[e]||(c.push(e),o++)}),c.sort().reverse(),!o)return;let l=n.type===`remote`?n.handles:a.handles;for(let t of s){let n=r.normalize(t.replace(e.mountpoint,`/`)).substring(1);if(a.type===`local`){let e=l.get(n),r=await i.loadRemoteEntry(e);i.storeLocalEntry(t,r)}else{let e=i.loadLocalEntry(t);await i.storeRemoteEntry(l,n,e)}}for(let t of c)if(a.type===`local`)i.removeLocalEntry(t);else{let n=r.normalize(t.replace(e.mountpoint,`/`)).substring(1);await i.removeRemoteEntry(l,n)}},`reconcile`)};e.FS.filesystems.NATIVEFS_ASYNC=i}E(Oe,`initializeNativeFS`);var ke=E(async e=>{let t=[];async function n(e){for await(let r of e.values())t.push(r),r.kind===`directory`&&await n(r)}E(n,`collect`),await n(e);let r=new Map;r.set(`.`,e);for(let n of t){let t=(await e.resolve(n)).join(`/`);r.set(t,n)}return r},`getFsHandles`),Ae=me(`AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL`),je=async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&typeof navigator.maxTouchPoints<`u`&&navigator.maxTouchPoints>1)))try{let e=await WebAssembly.compile(Ae);return await WebAssembly.instantiate(e)}catch(e){if(e instanceof WebAssembly.CompileError)return;throw e}}();async function Me(){let e=await je;if(e)return e.exports;let t=Symbol(`error marker`);return{Jsv_GetError_import:E(()=>t,`Jsv_GetError_import`),JsvError_Check:E(e=>e===t,`JsvError_Check`)}}E(Me,`getJsvErrorImport`);function Ne(e){let t={config:e,runtimeEnv:B},n={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:ze(e),print:e.stdout,printErr:e.stderr,onExit(e){n.exitCode=e},thisProgram:e._sysExecutable,arguments:e.args,API:t,locateFile:E(t=>e.indexURL+t,`locateFile`),instantiateWasm:Be(e.indexURL)};return n}E(Ne,`createSettings`);function Pe(e){return function(t){try{t.FS.mkdirTree(e)}catch(t){console.error(`Error occurred while making a home directory '${e}':`),console.error(t),console.error(`Using '/' for a home directory instead`),e=`/`}t.FS.chdir(e)}}E(Pe,`createHomeDirectory`);function Fe(e){return function(t){Object.assign(t.ENV,e)}}E(Fe,`setEnvironment`);function Ie(e){return e?[async t=>{t.addRunDependency(`fsInitHook`);try{await e(t.FS,{sitePackages:t.API.sitePackages})}finally{t.removeRunDependency(`fsInitHook`)}}]:[]}E(Ie,`callFsInitHook`);function Le(e){let t=e.HEAPU32[e._Py_Version>>>2];return[t>>>24&255,t>>>16&255,t>>>8&255]}E(Le,`computeVersionTuple`);function Re(e){let t=Se(e);return async e=>{e.API.pyVersionTuple=Le(e);let[n,r]=e.API.pyVersionTuple;e.FS.mkdirTree(`/lib`),e.API.sitePackages=`/lib/python${n}.${r}/site-packages`,e.FS.mkdirTree(e.API.sitePackages),e.FS.mkdirTree(`/lib/python${n}.${r}/lib-dynload`),e.addRunDependency(`install-stdlib`);try{let i=await t;e.FS.writeFile(`/lib/python${n}${r}.zip`,i)}catch(e){console.error(`Error occurred while installing the standard library:`),console.error(e)}finally{e.removeRunDependency(`install-stdlib`)}}}E(Re,`installStdlib`);function ze(e){let t;return t=e.stdLibURL==null?e.indexURL+`python_stdlib.zip`:e.stdLibURL,[Re(t),Pe(e.env.HOME),Fe(e.env),Oe,...Ie(e.fsInit)]}E(ze,`getFileSystemInitializationFuncs`);function Be(e){if(typeof WasmOffsetConverter<`u`)return;let{binary:t,response:n}=xe(e+`pyodide.asm.wasm`),r=Me();return function(e,i){return async function(){let{Jsv_GetError_import:a,JsvError_Check:o}=await r;e.env.Jsv_GetError_import=a,e.env.JsvError_Check=o;try{let r;r=n?await WebAssembly.instantiateStreaming(n,e):await WebAssembly.instantiate(await t,e);let{instance:a,module:o}=r;i(a,o)}catch(e){console.warn(`wasm instantiation failed!`),console.warn(e)}}(),{}}}E(Be,`getInstantiateWasmFunc`);var Ve=`314.0.6`;function Z(e){return e===void 0||e.endsWith(`/`)?e:e+`/`}E(Z,`withTrailingSlash`);var He=Ve;async function Q(e={}){if(await q(),e.lockFileContents&&e.lockFileURL)throw Error(`Can't pass both lockFileContents and lockFileURL`);let t=e.indexURL||await Ee();if(t=Z(_e(t)),e.packageBaseUrl=Z(e.packageBaseUrl),e.cdnUrl=Z(e.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v314.0.6/full/`),!e.lockFileContents){let n=e.lockFileURL??t+`pyodide-lock.json`;e.lockFileContents=Te(n),e.packageBaseUrl??=De(n)}e.indexURL=t,e.packageCacheDir&&=Z(_e(e.packageCacheDir));let n={jsglobals:globalThis,stdin:globalThis.prompt?()=>globalThis.prompt():void 0,args:[],env:{},packages:[],packageCacheDir:e.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:`6f88bdfdf0581f0eab1d84a508b31ab96e83201d2b7fdd1dc653a3079c23a0f5`},r=Object.assign(n,e);return r.env.HOME??=`/home/pyodide`,r.env.PYTHONINSPECT??=`1`,r}E(Q,`initializeConfiguration`);function Ue(e){let t=Ne(e),n=t.API;return n.lockFilePromise=Promise.resolve(e.lockFileContents),t}E(Ue,`createEmscriptenSettings`);async function We(e){return e.createPyodideModule?e.createPyodideModule:(await Ce(`${e.indexURL}pyodide.asm.mjs`)).default}E(We,`loadWasmScript`);async function Ge(e,t){if(!e._loadSnapshot)return;let n=await e._loadSnapshot,r=ArrayBuffer.isView(n)?n:new Uint8Array(n);return t.noInitialRun=!0,t.INITIAL_MEMORY=r.length,r}E(Ge,`prepareSnapshot`);async function Ke(e,t){let n=await e(t);if(t.exitCode!==void 0)throw new n.ExitStatus(t.exitCode);return n}E(Ke,`instantiatePyodideModule`);function qe(e,t){let n=e.API;if(t.pyproxyToStringRepr&&n.setPyProxyToStringMethod(!0),t.convertNullToNone&&n.setCompatNullToNone(!0),t.toJsLiteralMap&&n.setCompatToJsLiteralMap(!0),n.version!==`314.0.6`&&t.checkAPIVersion)throw Error(`Pyodide version does not match: '${He}' <==> '${n.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);e.locateFile=e=>{throw e.endsWith(`.so`)?Error(`Failed to find dynamic library "${e}"`):Error(`Unexpected call to locateFile("${e}")`)}}E(qe,`configureAPI`);function Je(e,t,n){let r=e.API,i;return t&&(i=r.restoreSnapshot(t)),r.finalizeBootstrap(i,n._snapshotDeserializer)}E(Je,`bootstrapPyodide`);async function Ye(e,t){let n=e._api;return n.sys.path.insert(0,``),n._pyodide.set_excepthook(),await n.packageIndexReady,n.initializeStreams(t.stdin,t.stdout,t.stderr),e}E(Ye,`finalizeSetup`);async function Xe(e={}){let t=await Q(e),n=Ue(t),r=await We(t),i=await Ge(t,n),a=await Ke(r,n);return qe(a,t),await Ye(Je(a,i,t),t)}E(Xe,`loadPyodide`);const Ze=Object.fromEntries(Object.entries(Object.assign({"../../../core/mined_core/__init__.py":`"""Mine D 판정 코어 v7 (멘토 뼈대). CPython 과 Pyodide 에서 같은 코드로 실행한다."""
from .run import run, run_json  # noqa: F401

VERSION = "0.7.0"
`,"../../../core/mined_core/changepoint.py":`"""PELT(평균 변화, L2 비용). ruptures 는 Pyodide 패키지 목록에 없어서 같은 방식을 짧게 직접 구현한다.

연구용으로는 ruptures.Pelt(model="l2") 와 결과를 비교하는 테스트가 tests/ 에 있다.
"""
from __future__ import annotations

import math

import numpy as np


def pelt_l2(x: np.ndarray, pen: float, min_size: int = 8) -> list[int]:
    """변화점 위치(새 구간의 첫 인덱스) 목록. x 에 결측이 없어야 한다."""
    n = len(x)
    if n < 2 * min_size:
        return []
    cs = np.concatenate([[0.0], np.cumsum(x)])
    cs2 = np.concatenate([[0.0], np.cumsum(x * x)])

    def cost(s: int, e: int) -> float:
        m = e - s
        sm = cs[e] - cs[s]
        return (cs2[e] - cs2[s]) - sm * sm / m

    F = np.full(n + 1, np.inf)
    F[0] = -pen
    last = np.zeros(n + 1, dtype=int)
    R = [0]
    for t in range(min_size, n + 1):
        cands = [s for s in R if t - s >= min_size]
        if not cands:
            R.append(t)
            continue
        vals = [F[s] + cost(s, t) + pen for s in cands]
        k = int(np.argmin(vals))
        F[t] = vals[k]
        last[t] = cands[k]
        keep = [s for s, v in zip(cands, vals) if v - pen <= F[t]]
        young = [s for s in R if t - s < min_size]
        R = keep + young + [t]
    cps = []
    t = n
    while t > 0:
        s = int(last[t])
        if s > 0:
            cps.append(s)
        t = s
    return sorted(cps)


def auto_penalty(x: np.ndarray, k: float = 3.0) -> float:
    """BIC 형 페널티 k·σ²·log n. σ 는 1차 차분의 MAD 로 추정(이상치에 덜 흔들림)."""
    if len(x) < 3:
        return math.inf
    d = np.diff(x)
    mad = np.median(np.abs(d - np.median(d)))
    sigma = 1.4826 * mad / math.sqrt(2)
    if sigma <= 1e-12:
        sigma = float(np.std(x)) or 1.0
    return k * sigma * sigma * math.log(len(x))


def changepoints_with_gaps(values: np.ndarray, kind: str, k: float = 3.0, min_size: int = 8,
                           woy: list[int] | None = None) -> list[int]:
    """결측(nan)을 빼고 이어 붙인 수열에서 PELT 를 돌린 뒤 원래 주 인덱스로 되돌린다.

    woy(주차 번호)를 주면 연 주기 성분을 먼저 뺀다(계절 변화를 시기 경계로 잡지 않게).
    """
    v = values.astype(float)
    if kind == "count":
        v = np.log1p(v)
    if woy is not None:
        v = deseasonalize(v, woy)
    idx = np.where(~np.isnan(v))[0]
    if len(idx) < 2 * min_size:
        return []
    x = v[idx]
    pen = auto_penalty(x, k)
    return [int(idx[c]) for c in pelt_l2(x, pen, min_size)]


def deseasonalize(values: np.ndarray, woy: list[int], min_years: float = 2.0) -> np.ndarray:
    """연 주기(주차별) 성분을 뺀 수열. 기록이 2년 미만이면 그대로 돌려준다.

    가운데 정렬 53주 이동 중앙값을 추세로 보고, 추세를 뺀 값의 주차별 중앙값(앞뒤 2주로 원형 평활)을 계절 성분으로 뺀다.
    결측(nan)은 그대로 둔다. 판정이 아니라 시기 경계(변화점)를 찾을 때만 쓴다.
    """
    v = values.astype(float)
    n = len(v)
    obs = ~np.isnan(v)
    if obs.sum() < 52 * min_years:
        return v
    half = 26
    trend = np.full(n, np.nan)
    for i in range(n):
        seg = v[max(0, i - half):min(n, i + half + 1)]
        seg = seg[~np.isnan(seg)]
        if len(seg) >= 20:
            trend[i] = np.median(seg)
    det = v - trend
    prof = np.full(54, np.nan)
    woy_a = np.array(woy)
    for k in range(1, 54):
        x = det[(woy_a == k) & ~np.isnan(det)]
        if len(x) >= 2:
            prof[k] = np.median(x)
    sm = np.zeros(54)
    for k in range(1, 54):
        nb = [prof[((k - 1 + d) % 53) + 1] for d in range(-2, 3)]
        nb = [x for x in nb if not np.isnan(x)]
        sm[k] = float(np.mean(nb)) if nb else 0.0
    return v - sm[woy_a]


def strong_shift(values: np.ndarray, cp: int, span: int = 26, min_effect: float = 1.5) -> float:
    """변화점 앞뒤 span 주 평균 차이를 잡음 크기(1차 차분 MAD)로 나눈 효과 크기. 앞뒤 관측이 모자라면 0."""
    x = values
    a = x[max(0, cp - span):cp]
    b = x[cp:cp + span]
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if len(a) < span // 2 or len(b) < span // 2:
        return 0.0
    xs = x[~np.isnan(x)]
    d = np.diff(xs)
    sigma = 1.4826 * np.median(np.abs(d - np.median(d))) / math.sqrt(2)
    if sigma <= 1e-12:
        return 0.0
    return float(abs(np.mean(b) - np.mean(a)) / sigma)
`,"../../../core/mined_core/cli.py":`"""명령줄: 판정·검증·평가.

  mined judge daily.json meta.json -o result.json [--set q_badge=0.03 --set cp_restart=true]
  mined validate result.json
  mined eval synth/out/long -o report.json [--quick]
  mined field daily.json meta.json events.json -o report.json [--quick]   (참가자 평가 보고서, 숫자만)
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

from . import evaluate, field_eval, validate
from .run import run


def _cfg(pairs: list[str] | None) -> dict:
    out = {}
    for p in pairs or []:
        k, v = p.split("=", 1)
        try:
            out[k] = json.loads(v)
        except json.JSONDecodeError:
            out[k] = v
    return out


def _load(p: str):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def cmd_judge(a):
    res = run(_load(a.daily), _load(a.meta) if a.meta else {}, _cfg(a.set))
    s = json.dumps(res, ensure_ascii=False)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(json.dumps(res["summary"], ensure_ascii=False, indent=1))


def cmd_validate(a):
    print(json.dumps(validate.report(_load(a.result), n_iter=a.iter), ensure_ascii=False, indent=1))


def cmd_eval(a):
    d = pathlib.Path(a.persona)
    daily = _load(d / "truth_daily.json")
    meta = _load(d / "truth_meta.json")
    events = _load(d / "events.json") if (d / "events.json").exists() else []
    if isinstance(events, dict):
        events = events.get("events", [])
    cfg = _cfg(a.set)
    t0 = time.time()
    full = run(daily, meta, cfg)
    rep = {"persona": d.name, "config": cfg, "summary": full["summary"]}
    rep["validate"] = validate.report(full, n_iter=200 if a.quick else 1000)
    rep["validate"].pop("corr", None)
    if events:
        rep["anchors"] = evaluate.anchors(full, events)
    rep["holdout"] = evaluate.holdout(daily, meta, cfg, full=full, n_boot=200 if a.quick else 1000)
    ev_weeks = set().union(*evaluate.event_weeks(events)) if events else set()
    avoid = {w["week"] for w in full["weeks"] if w["date_start"] in ev_weeks}
    rep["injection_hard"] = evaluate.injection(daily, meta, cfg, pattern="hard", runs=1 if a.quick else 3, avoid=avoid)
    rep["injection_steps"] = evaluate.injection(daily, meta, cfg, pattern="steps", runs=1 if a.quick else 3, avoid=avoid)
    rep["window"] = evaluate.window_sensitivity(daily, meta, cfg)
    rep["missing"] = evaluate.missing_sensitivity(daily, meta, cfg)
    rep["seconds"] = round(time.time() - t0, 1)
    s = json.dumps(rep, ensure_ascii=False, indent=1)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(s)


def cmd_field(a):
    events = _load(a.events) if a.events else []
    if isinstance(events, dict):
        events = events.get("events", [])
    rep = field_eval.field_report(_load(a.daily), _load(a.meta), events, {"quick": a.quick, "config": _cfg(a.set)},
                                  progress=lambda s: print(f"  {s}", file=sys.stderr, flush=True))
    s = json.dumps(rep, ensure_ascii=False, indent=1)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(s)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="mined")
    sub = ap.add_subparsers(dest="cmd", required=True)
    j = sub.add_parser("judge")
    j.add_argument("daily")
    j.add_argument("meta", nargs="?")
    j.add_argument("-o", "--out")
    j.add_argument("--set", action="append")
    j.set_defaults(fn=cmd_judge)
    v = sub.add_parser("validate")
    v.add_argument("result")
    v.add_argument("--iter", type=int, default=1000)
    v.set_defaults(fn=cmd_validate)
    e = sub.add_parser("eval")
    e.add_argument("persona")
    e.add_argument("-o", "--out")
    e.add_argument("--set", action="append")
    e.add_argument("--quick", action="store_true")
    e.set_defaults(fn=cmd_eval)
    f = sub.add_parser("field")
    f.add_argument("daily")
    f.add_argument("meta")
    f.add_argument("events", nargs="?")
    f.add_argument("-o", "--out")
    f.add_argument("--set", action="append")
    f.add_argument("--quick", action="store_true")
    f.set_defaults(fn=cmd_field)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
`,"../../../core/mined_core/coverage.py":`"""결측 세 종류 마스크: observed(관측된 0 포함) / structural_missing / partial.

개수 채널은 활동 범위 안에서 기록이 0인 주가 이어지는 구간(0 연속)을 본다.
계획서 초안은 "평소 0 연속 길이의 99백분위"를 기준으로 적었지만, 99백분위는 긴 공백 자체에
끌려가서(공백 하나가 곧 최댓값이 된다) 공백을 못 찾는다. 그래서 0 연속 길이 분포의
Tukey 먼 울타리(Q3 + 3·IQR)와 채널별 최솟값 중 큰 값을 기준으로 쓴다.
"""
from __future__ import annotations

import datetime as dt
import math

from .indicators import CHANNEL_COUNT_FIELDS, DAY_FAMILIES, FAMILIES
from .weeks import parse_date

# 이 길이(주)보다 짧은 0 연속은 언제나 관측된 0으로 본다
MIN_GAP_WEEKS = {"memo": 8, "photo": 6, "yt": 4, "cal": 12, "kakao": 4, "sns": 8, "ai": 6, "git": 8}
HEALTH_MIN_DAYS = 4
PARTIAL_MIN_DAYS = 5  # 범위 경계 주에서 이 날 수보다 적게 들어가면 부분 관측


def _quantile(xs: list[int], q: float) -> float:
    s = sorted(xs)
    if not s:
        return 0.0
    pos = (len(s) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def gap_threshold(runs: list[int], ch: str) -> int:
    base = MIN_GAP_WEEKS.get(ch, 6)
    if len(runs) < 8:
        return base
    q1, q3 = _quantile(runs, 0.25), _quantile(runs, 0.75)
    fence = q3 + 3 * (q3 - q1)
    return max(base, int(math.ceil(fence)))


def coverage_masks(mondays: list[dt.date], weeks: list[dict], meta: dict, gap_detection: bool = True) -> tuple[dict[str, list[str]], dict]:
    n = len(weeks)
    masks: dict[str, list[str]] = {}
    info: dict[str, dict] = {}
    explicit = (meta or {}).get("gaps", {}) or {}
    for ch in FAMILIES:
        in_range = [w.get(f"{ch}_in_range_days", 0) for w in weeks]
        m = ["structural_missing"] * n
        if ch in DAY_FAMILIES:
            for i, w in enumerate(weeks):
                days = max(w.get(f, 0) for f in DAY_FAMILIES[ch])
                if in_range[i] == 0:
                    continue
                m[i] = "observed" if days >= HEALTH_MIN_DAYS else ("partial" if days > 0 else "structural_missing")
            masks[ch] = m
            info[ch] = {"observed_weeks": m.count("observed")}
            continue
        fields = CHANNEL_COUNT_FIELDS[ch]
        totals = [sum(w.get(f, 0) for f in fields) for w in weeks]
        for i in range(n):
            if in_range[i] == 0:
                continue
            m[i] = "observed" if in_range[i] >= PARTIAL_MIN_DAYS else "partial"
        # 활동 범위 안의 0 연속
        runs: list[tuple[int, int]] = []
        i = 0
        while i < n:
            if m[i] == "observed" and totals[i] == 0:
                j = i
                while j < n and m[j] == "observed" and totals[j] == 0:
                    j += 1
                runs.append((i, j))
                i = j
            else:
                i += 1
        thr = gap_threshold([b - a for a, b in runs], ch) if gap_detection else 10**9
        n_gap = 0
        for a, b in runs:
            if b - a > thr:
                for k in range(a, b):
                    m[k] = "structural_missing"
                n_gap += 1
        # 사용자가 알려 준 공백
        for a_s, b_s in explicit.get(ch, []) or []:
            a_d, b_d = parse_date(a_s), parse_date(b_s)
            for k, mon in enumerate(mondays):
                if mon <= b_d and mon + dt.timedelta(days=6) >= a_d:
                    m[k] = "structural_missing"
        masks[ch] = m
        info[ch] = {"gap_threshold_weeks": thr, "gaps": n_gap, "observed_weeks": m.count("observed")}
    return masks, info
`,"../../../core/mined_core/evaluate.py":`"""정답 없이 품질을 주장하는 대리 검증(2-5). 합성 인물처럼 정답 사건이 있는 데이터에서는 재현율도 잰다.

- holdout: 채널 하나를 빼고 판정한 주에서, 뺀 채널도 평소 범위를 벗어난 비율 ÷ 무작위 주에서의 비율
- injection: 실제 일 단위 표의 무작위 주에 인위적 변화를 넣고 찾아내는 비율(변화 크기별)
- window: 26·52·104주 창 판정 결과의 자카드 계수
- missing: 결측 가정을 바꿔도 판정이 유지되는 주의 비율
- anchors: 미리 적어 둔 사건 앞뒤 2주에 판정이 무작위보다 몰리는지
"""
from __future__ import annotations

import copy
import datetime as dt

import numpy as np

from .indicators import FAMILIES, FIELD_CHANNEL, INDICATORS
from .run import run
from .weeks import monday, parse_date


def _cand(result: dict) -> set[str]:
    return {w["week"] for w in result["weeks"] if w["candidate"]}


def _judged(result: dict) -> list[str]:
    return [w["week"] for w in result["weeks"] if any(v["pr"] is not None for v in w["ind"].values())]


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if (a | b) else 1.0


def drop_channel(daily: list[dict], meta: dict, ch: str):
    d2 = [{k: v for k, v in r.items() if k == "date" or FIELD_CHANNEL.get(k) != ch} for r in daily]
    m2 = copy.deepcopy(meta)
    (m2.get("channels") or {}).pop(ch, None)
    (m2.get("gaps") or {}).pop(ch, None)
    return d2, m2


def holdout(daily: list[dict], meta: dict, cfg: dict | None = None, q_hit: float = 0.10, n_boot: int = 1000,
            seed: int = 0, full: dict | None = None) -> dict:
    full = full or run(daily, meta, cfg)
    idx = {w["week"]: k for k, w in enumerate(full["weeks"])}
    rng = np.random.default_rng(seed)
    out = {}
    for ch in FAMILIES:
        inds = [i.id for i in INDICATORS if i.family == ch]

        def hit(wk: dict) -> bool | None:
            prs = [wk["ind"][i]["pr"] for i in inds if wk["ind"][i]["pr"] is not None]
            if not prs:
                return None
            return any(p <= q_hit or p >= 1 - q_hit for p in prs)

        base_hits = [h for h in (hit(w) for w in full["weeks"]) if h is not None]
        if len(base_hits) < 30:
            continue
        d2, m2 = drop_channel(daily, meta, ch)
        minus = run(d2, m2, cfg)
        C = [w["week"] for w in minus["weeks"] if w["candidate"]]
        hs = [h for h in (hit(full["weeks"][idx[k]]) for k in C if k in idx) if h is not None]
        if len(hs) < 5:
            out[ch] = {"n_candidates_without": len(C), "n_scored": len(hs)}
            continue
        base = float(np.mean(base_hits))
        rate = float(np.mean(hs))
        boots = [np.mean(rng.choice(hs, len(hs), replace=True)) / base for _ in range(n_boot)]
        out[ch] = {
            "n_candidates_without": len(C), "n_scored": len(hs),
            "hit_rate": round(rate, 3), "base_rate": round(base, 3),
            "lift": round(rate / base, 3) if base > 0 else None,
            "lift_ci95": [round(float(np.percentile(boots, 2.5)), 3), round(float(np.percentile(boots, 97.5)), 3)],
        }
    return out


PATTERNS = {
    # 힘든 주: 걸음↓ 수면↓ 새벽 시청↑ 새벽 메모↑ (10/22 지표 넷에서 판정에 쓰는 건 걸음·수면·새벽 메모. 새벽 시청은 근거 전용)
    "hard": lambda r, m: {
        **r,
        **({"steps": int(r["steps"] * (1 - m))} if "steps" in r else {}),
        **({"sleep_min": int(max(60, r["sleep_min"] - 150 * m))} if "sleep_min" in r else {}),
        **({"yt_watch_night_n": min(r.get("yt_watch_n", 0), r.get("yt_watch_night_n", 0) + round(r.get("yt_watch_n", 0) * m))}
           if r.get("yt_watch_n") else {}),
        **({"memo_night_n": min(r.get("memo_n", 0), r.get("memo_night_n", 0) + round(r.get("memo_n", 0) * m))}
           if r.get("memo_n") else {}),
    },
    # 걸음만 줄어듦(한 채널)
    "steps": lambda r, m: {**r, **({"steps": int(r["steps"] * (1 - m))} if "steps" in r else {})},
}


def injection(daily: list[dict], meta: dict, cfg: dict | None = None, magnitudes=(0.1, 0.2, 0.3, 0.5),
              pattern: str = "hard", per_run: int = 8, runs: int = 3, seed: int = 0, spacing: int = 20,
              avoid: set[str] | None = None, base: dict | None = None) -> dict:
    base = base or run(daily, meta, cfg)
    fn = PATTERNS[pattern]
    need = {"hard": ["steps", "sleep", "memo_night"], "steps": ["steps"]}[pattern]
    eligible = [k for k, w in enumerate(base["weeks"])
                if all(w["ind"][i]["pr"] is not None for i in need) and not w["candidate"]
                and (not avoid or w["week"] not in avoid)]
    rng = np.random.default_rng(seed)
    by_week = {w["week"]: k for k, w in enumerate(base["weeks"])}
    rows_by_date = {r["date"]: i for i, r in enumerate(daily)}
    out = {}
    for m in magnitudes:
        cand_hits, badge_hits, total = 0, 0, 0
        for _ in range(runs):
            picks: list[int] = []
            for k in rng.permutation(eligible):
                if all(abs(int(k) - p) >= spacing for p in picks):
                    picks.append(int(k))
                if len(picks) >= per_run:
                    break
            d2 = list(daily)
            for k in picks:
                mon = parse_date(base["weeks"][k]["date_start"])
                for off in range(7):
                    ds = (mon + dt.timedelta(days=off)).isoformat()
                    if ds in rows_by_date:
                        i = rows_by_date[ds]
                        d2[i] = fn(daily[i], m)
            res = run(d2, meta, cfg)
            for k in picks:
                wk = res["weeks"][k]
                total += 1
                cand_hits += int(wk["candidate"])
                badge_hits += int(any(b["indicator"] in need for b in wk["badges"]))
        out[str(m)] = {"n": total, "candidate_recall": round(cand_hits / total, 3) if total else None,
                       "badge_recall": round(badge_hits / total, 3) if total else None}
    return out


def window_sensitivity(daily: list[dict], meta: dict, cfg: dict | None = None, windows=(26, 52, 104),
                       base: dict | None = None) -> dict:
    """base: 기본 창(52주)으로 이미 판정한 결과가 있으면 그 주는 다시 판정하지 않는다."""
    cfg = cfg or {}
    sets = {}
    for W in windows:
        if W == 52 and base is not None and "window" not in cfg and "min_base" not in cfg:
            sets[W] = _cand(base)
        else:
            sets[W] = _cand(run(daily, meta, {**cfg, "window": W, "min_base": min(26, W // 2)}))
    ref = sets[52]
    return {str(W): {"n": len(s), "jaccard_vs_52": round(jaccard(s, ref), 3)} for W, s in sets.items()}


def missing_sensitivity(daily: list[dict], meta: dict, cfg: dict | None = None, base: dict | None = None) -> dict:
    base = base or run(daily, meta, cfg)
    C0 = _cand(base)
    gap_weeks = {ch: {w["date_start"] for w in base["weeks"] if w["coverage"][ch] == "structural_missing"} for ch in FAMILIES}
    rows = {r["date"]: dict(r) for r in daily}
    ranges = {ch: (parse_date(v["first"]), parse_date(v["last"])) for ch, v in (meta.get("channels") or {}).items()}

    def variant(fill: str):
        d2 = {k: dict(v) for k, v in rows.items()}
        for ch in ["memo", "photo", "yt", "cal", "kakao", "sns", "ai"]:
            if ch not in ranges:
                continue
            fields = [f for f, c in FIELD_CHANNEL.items() if c == ch]
            med = {f: float(np.median([r.get(f, 0) for r in rows.values()])) for f in fields}
            a, b = ranges[ch]
            for ws in gap_weeks[ch]:
                mon = parse_date(ws)
                for off in range(7):
                    d = mon + dt.timedelta(days=off)
                    if d < a or d > b:
                        continue
                    r = d2.setdefault(d.isoformat(), {"date": d.isoformat()})
                    for f in fields:
                        r[f] = 0 if fill == "low" else round(med[f])
        m2 = copy.deepcopy(meta)
        m2["gaps"] = {}
        cfg2 = {**(cfg or {})}
        return _cand(run(sorted(d2.values(), key=lambda r: r["date"]), m2, {**cfg2, "gap_detection": False}))

    low = variant("low")
    med = variant("median")
    return {
        "n_candidates": len(C0),
        "added_if_missing_is_low": len(low - C0),
        "added_if_missing_is_usual": len(med - C0),
        "kept_if_missing_is_low": round(len(C0 & low) / len(C0), 3) if C0 else None,
        "kept_if_missing_is_usual": round(len(C0 & med) / len(C0), 3) if C0 else None,
        "kept_both": round(len(C0 & low & med) / len(C0), 3) if C0 else None,
    }


def event_weeks(events: list[dict]) -> list[set[str]]:
    """사건마다 걸친 주(월요일 날짜) 집합. start+days 또는 start+end 형식. 영구 변화(end 없음)는 시작 주만."""
    out = []
    for e in events:
        a = parse_date(e["start"])
        if "days" in e:
            days = int(e["days"])
        elif e.get("end"):
            days = (parse_date(e["end"]) - a).days + 1
        else:
            days = 1
        ws = {monday(a + dt.timedelta(days=i)).isoformat() for i in range(days)}
        out.append(ws)
    return out


def anchors(result: dict, events: list[dict], window: int = 2, n_iter: int = 1000, seed: int = 0) -> dict:
    starts = [w["date_start"] for w in result["weeks"]]
    pos = {s: k for k, s in enumerate(starts)}
    W = len(starts)
    near = np.zeros(W, dtype=bool)
    ev_idx = []
    for ws in event_weeks(events):
        ks = [pos[s] for s in ws if s in pos]
        if not ks:
            continue
        ev_idx.append(ks)
        for k in ks:
            near[max(0, k - window):min(W, k + window + 1)] = True
    cand = np.array([w["candidate"] for w in result["weeks"]])
    judged = np.array([any(v["pr"] is not None for v in w["ind"].values()) for w in result["weeks"]])
    obs = float(cand[near].mean()) if near.any() else 0.0
    far = judged & ~near
    rng = np.random.default_rng(seed)
    null = [float(np.roll(cand, int(rng.integers(0, W)))[near].mean()) for _ in range(n_iter)]
    recall = float(np.mean([cand[max(0, min(ks) - 1):max(ks) + 2].any() for ks in ev_idx])) if ev_idx else None
    return {
        "n_events": len(ev_idx),
        "event_recall_pm1": None if recall is None else round(recall, 3),
        "candidate_share_near_events": round(obs, 3),
        "candidate_share_far": round(float(cand[far].mean()), 3) if far.any() else None,
        "null_mean_near": round(float(np.mean(null)), 3),
        "enrichment": round(obs / np.mean(null), 3) if np.mean(null) > 0 else None,
        "p_value": round(float(np.mean([x >= obs for x in null])), 4),
    }


def chance_rate(result: dict, events: list[dict], guard: int = 3) -> float | None:
    """사건(앞뒤 guard 주)과 영구 변화(시작 앞 guard 주~뒤 8주)에서 먼 주 가운데 판정된 주의 비율."""
    ev = event_weeks([e for e in events if not e.get("persistent")])
    starts = [w["date_start"] for w in result["weeks"]]
    pos = {s: k for k, s in enumerate(starts)}
    near = np.zeros(len(starts), dtype=bool)
    for ws in ev:
        for s in ws:
            if s in pos:
                k = pos[s]
                near[max(0, k - guard):k + guard + 1] = True
    for e in events:
        if e.get("persistent"):
            d = monday(parse_date(e["start"])).isoformat()
            if d in pos:
                k = pos[d]
                near[max(0, k - guard):k + 9] = True
    judged = np.array([any(v["pr"] is not None for v in w["ind"].values()) for w in result["weeks"]], dtype=bool)
    cand = np.array([w["candidate"] for w in result["weeks"]], dtype=bool)
    far = judged & ~near
    return round(float(cand[far].mean()), 3) if far.any() else None


def persistent_boundary_recall(result: dict, events: list[dict], tol: int = 6) -> dict:
    """영구 변화(이사·이직 등) 시작일 앞뒤 tol 주 안에 시기 경계가 있는 비율."""
    bounds = [parse_date(e["start"]) for e in result["eras"]][1:]
    pers = [e for e in events if e.get("persistent")]
    hits = []
    for e in pers:
        d = parse_date(e["start"])
        hits.append(any(abs((b - d).days) <= tol * 7 for b in bounds))
    return {"n": len(pers), "recall": round(float(np.mean(hits)), 3) if pers else None, "n_eras": len(result["eras"])}
`,"../../../core/mined_core/field_eval.py":`"""참가자 평가 보고서(실제 기록 평가). 기록 주인의 기기 안에서 계산하고, 밖으로 보내는 보고서에는 숫자만 담는다.

입력
- daily, meta: 일 단위 표와 채널 메타(docs/contract.md)
- events: 참가자가 결과를 보기 전에 적어 둔 사건. [{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"?, "kind": "hard"|"good"|"change"}]
  change(이사·이직·입학처럼 계속되는 변화)는 시기 경계 재현율에, 나머지는 사건 집중도와 재현율에 쓴다.
- opts: {"quick": 설정 비교·이상 주입을 건너뛴다, "config": 판정 설정 덮어쓰기}

출력 스키마는 mined.fieldeval/1 이다. 날짜(YYYY-MM-DD, YYYY-Www)가 섞이면 보고서를 만들지 않는다(닫힌 쪽 실패).
브라우저(Pyodide)와 명령줄(CPython)이 같은 함수를 부른다.
"""
from __future__ import annotations

import json
import re
import time

import numpy as np

from . import VERSION
from . import evaluate
from .indicators import FAMILIES
from .run import run
from .validate import meff, pr_matrix, spearman_pairwise

REPORT_SCHEMA = "mined.fieldeval/1"
KINDS = ("hard", "good", "change")

# docs/eval.md 의 설정 비교와 같은 대안(기본값과 견줄 것만)
ALT_CONFIGS = {
    "no_detrend": {"detrend": False},
    "q_badge_5pct": {"q_badge": 0.05, "q_extreme": 0.02},
    "single_extreme": {"single_extreme_candidate": True},
    # 팀 9/23 요청 4-1: 같은 기록·같은 사건으로 팀 v6 지표(robust z + 축 × 방향 τ)와 견준다
    "robust_z": {"metric": "robust_z"},
}

_DATE_RE = re.compile(r"\\d{4}-\\d{2}-\\d{2}|\\d{4}-W\\d{2}")


def normalize_events(events: list[dict]) -> list[dict]:
    """화면에서 적은 사건을 evaluate 모듈이 읽는 모양으로 바꾼다. 알 수 없는 종류와 날짜가 빠진 사건은 버린다."""
    out = []
    for e in events or []:
        kind = e.get("kind")
        start = str(e.get("start") or "")
        if kind not in KINDS or not re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", start):
            continue
        end = e.get("end")
        if kind != "change" and end and re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", str(end)) and str(end) >= start:
            out.append({"start": start, "end": str(end), "type": kind, "persistent": False})
        else:
            out.append({"start": start, "days": 1 if kind == "change" else 7, "type": kind, "persistent": kind == "change"})
    return out


def find_dates(obj, path: str = "") -> list[str]:
    """보고서 안에서 날짜처럼 보이는 문자열의 위치를 모두 찾는다(키 이름 포함)."""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if _DATE_RE.search(str(k)):
                hits.append(f"{path}/{k}(key)")
            hits += find_dates(v, f"{path}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += find_dates(v, f"{path}[{i}]")
    elif isinstance(obj, str) and _DATE_RE.search(obj):
        hits.append(path)
    return hits


def _judged_weeks(result: dict) -> int:
    return sum(1 for w in result["weeks"] if any(v["pr"] is not None for v in w["ind"].values()))


def _brief(result: dict, events: list[dict]) -> dict:
    transient = [e for e in events if not e["persistent"]]
    anc = evaluate.anchors(result, transient, n_iter=500) if transient else None
    s = result["summary"]
    return {
        "n_candidates": s["n_candidates"],
        "n_cross": s["n_cross"],
        "chance_rate_far": evaluate.chance_rate(result, events) if events else None,
        "event_recall_pm1": anc["event_recall_pm1"] if anc else None,
        "enrichment": anc["enrichment"] if anc else None,
        # 4-1 비교 항목: 방향별 잡힘(위·아래 균형), 광물 분포, 확인 등급 분포. 개수만 담는다
        "badge_directions": _count(b["direction"] for w in result["weeks"] if w["candidate"] for b in w["badges"]),
        "minerals": _count(w["mineral"] for w in result["weeks"] if w["candidate"] and w["mineral"]),
        "grades": s.get("grades"),
    }


def _count(xs) -> dict:
    out: dict = {}
    for x in xs:
        out[x] = out.get(x, 0) + 1
    return dict(sorted(out.items()))


def quiet_vs_sleep(daily: list[dict], meta: dict) -> dict | None:
    """밤 기록 공백(quiet)이 수면 기록을 얼마나 따라가는지: 둘 다 4일 이상 있는 주의 주 평균끼리 순위 상관(스피어만).

    수면 기록이 있는 사람의 기록으로만 잴 수 있고, 숫자만 담는다."""
    from .weeks import build_weeks
    _, weeks, _ = build_weeks(daily, meta)
    xs, ys = [], []
    for w in weeks:
        if w.get("sleep_days", 0) >= 4 and w.get("quiet_days", 0) >= 4:
            xs.append(w["sleep_min"] / w["sleep_days"])
            ys.append(w["quiet_min"] / w["quiet_days"])
    if len(xs) < 12:
        return {"n_weeks": len(xs), "spearman": None}
    rx = np.argsort(np.argsort(xs)).astype(float)
    ry = np.argsort(np.argsort(ys)).astype(float)
    r = float(np.corrcoef(rx, ry)[0, 1])
    return {"n_weeks": len(xs), "spearman": round(r, 3)}


def field_report(daily: list[dict], meta: dict, events: list[dict], opts: dict | None = None, progress=None) -> dict:
    opts = {"quick": False, **(opts or {})}
    say = progress or (lambda _s: None)
    cfg = dict(opts.get("config") or {})
    quick = bool(opts.get("quick"))
    ev = normalize_events(events)
    transient = [e for e in ev if not e["persistent"]]
    persistent = [e for e in ev if e["persistent"]]
    t0 = time.time()

    say("판정 다시 하는 중")
    full = run(daily, meta, cfg)
    s = full["summary"]
    n_weeks = s.get("n_weeks", 0)
    if not n_weeks:
        raise ValueError("판정할 주가 없습니다")
    judged = _judged_weeks(full)
    ch_meta = (meta or {}).get("channels") or {}
    channels = {}
    for ch in FAMILIES:
        c = s["coverage"][ch]
        if not c["observed_weeks"]:
            continue
        channels[ch] = {
            "observed_weeks": c["observed_weeks"],
            "share": c["share"],
            "gaps_found": c.get("gaps"),
            "sources": sorted(str(x) for x in (ch_meta.get(ch) or {}).get("sources", [])),
        }
    badge_families: dict[str, int] = {}
    for w in full["weeks"]:
        if w["candidate"]:
            for f in w["evidence"]["families"]:
                badge_families[f] = badge_families.get(f, 0) + 1

    rep: dict = {
        "schema": REPORT_SCHEMA,
        "core_version": VERSION,
        "mode": "quick" if quick else "full",
        "config": {k: v for k, v in full["config"].items() if isinstance(v, (int, float, bool, str)) or v is None},
        "span": {"n_weeks": n_weeks, "years": round(n_weeks / 52.18, 1), "judged_weeks": judged},
        "channels": channels,
        "result": {
            "n_candidates": s["n_candidates"],
            "n_cross": s["n_cross"],
            "n_single_source": s["n_single_source"],
            "candidate_rate": round(s["n_candidates"] / judged, 3) if judged else None,
            "grades": s["grades"],
            "n_confirm": s["n_confirm"],
            "n_eras": s["n_eras"],
            "n_episodes": s.get("n_episodes", 0),
            "cross_null": s.get("cross_null"),
            "families_in_candidates": dict(sorted(badge_families.items())),
            "linked_pairs": s.get("linked_pairs", []),
        },
        "events": {
            "n": len(ev),
            "by_kind": {k: sum(1 for e in ev if e["type"] == k) for k in KINDS},
            "dropped": len(events or []) - len(ev),
        },
    }

    say("사건 앞뒤에 판정이 몰리는지 보는 중")
    if transient:
        rep["anchors"] = evaluate.anchors(full, transient)
        rep["anchors_by_kind"] = {}
        for k in ("hard", "good"):
            sub = [e for e in transient if e["type"] == k]
            if sub:
                a = evaluate.anchors(full, sub, n_iter=500)
                rep["anchors_by_kind"][k] = {x: a[x] for x in ("n_events", "event_recall_pm1", "enrichment", "p_value")}
    if ev:
        rep["chance_rate_far"] = evaluate.chance_rate(full, ev)
    if persistent:
        rep["persistent_boundaries"] = evaluate.persistent_boundary_recall(full, ev)

    say("계열 사이 상관 계산 중")
    ids, M = pr_matrix(full)
    C = spearman_pairwise(M)
    live = [k for k in range(len(ids)) if np.sum(~np.isnan(M[:, k])) >= 30]
    rep["meff_all"] = meff(C[np.ix_(live, live)])

    say("채널 하나씩 빼고 판정하는 중")
    rep["holdout"] = evaluate.holdout(daily, meta, cfg, full=full, n_boot=200 if quick else 1000)
    say("창 길이를 바꿔 판정하는 중")
    rep["window"] = evaluate.window_sensitivity(daily, meta, cfg, base=full)
    say("결측 가정을 바꿔 판정하는 중")
    rep["missing"] = evaluate.missing_sensitivity(daily, meta, cfg, base=full)
    rep["quiet_vs_sleep"] = quiet_vs_sleep(daily, meta)

    if not quick:
        say("평소 주에 변화를 넣어 찾는지 보는 중")
        ev_weeks = set().union(*evaluate.event_weeks(ev)) if ev else set()
        avoid = {w["week"] for w in full["weeks"] if w["date_start"] in ev_weeks}
        rep["injection_hard"] = evaluate.injection(daily, meta, cfg, magnitudes=(0.2, 0.3, 0.5), pattern="hard",
                                                   runs=1, avoid=avoid, base=full)
        rep["configs"] = {"default": _brief(full, ev)}
        for name, alt in ALT_CONFIGS.items():
            say(f"설정 비교 중 ({name})")
            rep["configs"][name] = _brief(run(daily, meta, {**cfg, **alt}), ev)

    rep["seconds"] = round(time.time() - t0, 1)
    leaks = find_dates(rep)
    if leaks:
        raise ValueError(f"보고서에 날짜가 섞였습니다: {leaks[:5]}")
    return rep


def field_report_json(daily_json: str, meta_json: str, events_json: str, opts_json: str = "{}", progress=None) -> str:
    """Pyodide 진입점."""
    return json.dumps(field_report(json.loads(daily_json), json.loads(meta_json or "{}"), json.loads(events_json or "[]"),
                                   json.loads(opts_json or "{}"), progress), ensure_ascii=False)
`,"../../../core/mined_core/indicators.py":`"""지표 정의: 일 단위 표(docs/contract.md 1절)에서 주 단위 값을 계산하는 규칙과 문장 조각.

지표마다 계열(family, 같은 파일·같은 측정 과정)과 4축(axis) 중 어디에 속하는지 적는다.
문장 조각의 {r} 자리에는 "직전 52주 중 가장" / "직전 52주 중 네 번째로" 가 들어간다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

FAMILIES = ["health", "memo", "photo", "yt", "cal", "kakao", "sns", "ai", "quiet", "screen", "git"]
FAMILY_LABEL = {"health": "건강", "memo": "메모", "photo": "사진", "yt": "유튜브", "cal": "캘린더", "kakao": "카카오톡",
                "sns": "인스타그램", "ai": "AI 대화", "quiet": "밤 공백",
                "screen": "스크린타임", "git": "깃헙"}
# 다른 채널의 활동 시각에서 계산한 계열. 독립 근거로 세지 않는다(교차검증 수에 넣지 않음)
DERIVED_FAMILIES = {"quiet"}
# 팀 결정(10/22 화면설계 v6 §8): 지표 넷 = 수면 · 걸음 · 언어 · 소통. 축 키는 move/rest/lang/talk.
# 이전 보기(watch)·남기기(leave)는 없앴다. 남기기는 언어(글로 남긴 것)와 소통(사람과 주고받은 것)으로 나눴고,
# 유튜브·스크린타임·사진·화면 캡처·일정은 어느 지표에도 넣지 않는다(axis=None). 이 기록들은 광석 판정에 쓰지 않고
# 열린 광석의 근거(그때의 사진·수치)로만 보여 준다.
AXES = ["move", "rest", "lang", "talk"]
AXIS_NAMES = {
    "move": {"label": "걸음", "screen": "걸음"},
    "rest": {"label": "수면", "screen": "수면"},
    "lang": {"label": "언어", "screen": "언어"},
    "talk": {"label": "소통", "screen": "소통"},
}
AXIS_LABEL = {ax: v["screen"] for ax, v in AXIS_NAMES.items()}


def axis_screen(ax: str) -> str:
    return AXIS_NAMES[ax]["screen"]


@dataclass(frozen=True)
class Indicator:
    id: str
    label: str
    family: str
    axis: str | None  # None 이면 4지표 밖(근거 전용): 배지·광석·게이지에 쓰지 않는다
    kind: str  # count | level | ratio
    down: str  # 적은 쪽 문장 조각
    up: str  # 많은 쪽 문장 조각
    gauge: bool = False  # 4축 게이지에 들어가는 '양' 지표인지
    compute: Callable[[dict], float | None] | None = None


def _ratio(num: str, den: str, min_den: int):
    def f(w: dict) -> float | None:
        d = w.get(den, 0)
        if d < min_den:
            return None
        return w.get(num, 0) / d

    return f


def _mean_level(field: str, days_field: str, min_days: int = 4):
    def f(w: dict) -> float | None:
        if w.get(days_field, 0) < min_days:
            return None
        return w.get(field, 0) / w[days_field]

    return f


def _sum(field: str):
    return lambda w: float(w.get(field, 0))


INDICATORS: list[Indicator] = [
    Indicator("steps", "걸음수", "health", "move", "level",
              "걸음수가 {r} 적었습니다", "걸음수가 {r} 많았습니다", True,
              _mean_level("steps", "steps_days")),
    Indicator("sleep", "수면 시간", "health", "rest", "level",
              "잠이 {r} 짧았습니다", "잠이 {r} 길었습니다", True,
              _mean_level("sleep_min", "sleep_days")),
    # 팀 9/23 §1-2 밤 무기록 구간 대체 지표: 수면 기록이 없을 때 쉼 축을 채운다. 잠이 아니라 기록이 끊긴 시간이다
    Indicator("quiet", "밤 기록 공백", "quiet", "rest", "level",
              "밤에 기록이 끊긴 시간이 {r} 짧았습니다", "밤에 기록이 끊긴 시간이 {r} 길었습니다", True,
              _mean_level("quiet_min", "quiet_days")),
    # 회의 질문 1: 스크린타임 캡처(기기 안 OCR)에서 읽은 하루 사용 시간(분)
    Indicator("screen_time", "스크린타임", "screen", None, "level",
              "휴대폰 사용 시간이 {r} 짧았습니다", "휴대폰 사용 시간이 {r} 길었습니다", True,
              _mean_level("screen_min", "screen_days")),
    # 회의 질문 4: git log 또는 GitHub 데이터 내보내기의 커밋 수
    Indicator("git_commits", "커밋 수", "git", "lang", "count",
              "커밋을 {r} 적게 남겼습니다", "커밋을 {r} 많이 남겼습니다", False, _sum("git_commits")),
    Indicator("memo_n", "메모 작성 수", "memo", "lang", "count",
              "메모를 {r} 적게 남겼습니다", "메모를 {r} 많이 남겼습니다", True, _sum("memo_n")),
    Indicator("memo_len", "메모 길이", "memo", "lang", "ratio",
              "메모가 {r} 짧았습니다", "메모가 {r} 길었습니다", False,
              _ratio("memo_chars", "memo_n", 2)),
    Indicator("memo_night", "메모 심야 작성 비율", "memo", "lang", "ratio",
              "새벽에 쓴 메모의 비율이 {r} 낮았습니다", "새벽에 쓴 메모의 비율이 {r} 높았습니다", False,
              _ratio("memo_night_n", "memo_n", 3)),
    Indicator("photo_n", "사진 촬영 수", "photo", None, "count",
              "사진을 {r} 적게 찍었습니다", "사진을 {r} 많이 찍었습니다", True, _sum("photo_n")),
    # 9/12 회의 1번: 스크린샷은 내용을 읽지 않고 「그 주에 몇 장, 몇 시에」만 센다(사진 폴더 안 화면 캡처)
    Indicator("shot_n", "화면 캡처 수", "photo", None, "count",
              "화면을 {r} 적게 캡처했습니다", "화면을 {r} 많이 캡처했습니다", False, _sum("shot_n")),
    Indicator("shot_night", "새벽 화면 캡처 비율", "photo", None, "ratio",
              "새벽에 한 화면 캡처의 비율이 {r} 낮았습니다", "새벽에 한 화면 캡처의 비율이 {r} 높았습니다", False,
              _ratio("shot_night_n", "shot_n", 3)),
    Indicator("photo_night", "심야 촬영 비율", "photo", None, "ratio",
              "새벽에 찍은 사진의 비율이 {r} 낮았습니다", "새벽에 찍은 사진의 비율이 {r} 높았습니다", False,
              _ratio("photo_night_n", "photo_n", 5)),
    Indicator("yt_watch", "유튜브 시청 수", "yt", None, "count",
              "유튜브를 {r} 적게 봤습니다", "유튜브를 {r} 많이 봤습니다", True, _sum("yt_watch_n")),
    Indicator("yt_night", "유튜브 심야 비율", "yt", None, "ratio",
              "새벽에 본 영상의 비율이 {r} 낮았습니다", "새벽에 본 영상의 비율이 {r} 높았습니다", False,
              _ratio("yt_watch_night_n", "yt_watch_n", 5)),
    Indicator("yt_search", "유튜브 검색량", "yt", None, "count",
              "유튜브 검색을 {r} 적게 했습니다", "유튜브 검색을 {r} 많이 했습니다", True, _sum("yt_search_n")),
    Indicator("cal_n", "일정 개수", "cal", None, "count",
              "일정이 {r} 적었습니다", "일정이 {r} 많았습니다", True, _sum("cal_n")),
    # 10/22 소통 지표의 양(量) 게이지: 카톡을 몇 번 보냈는지(원문은 읽지 않고 개수만)
    Indicator("kakao_n", "카톡 보낸 수", "kakao", "talk", "count",
              "카톡을 {r} 적게 보냈습니다", "카톡을 {r} 많이 보냈습니다", True, _sum("kakao_n")),
    Indicator("kakao_night", "카톡 새벽 발화 비율", "kakao", "talk", "ratio",
              "새벽에 보낸 카톡의 비율이 {r} 낮았습니다", "새벽에 보낸 카톡의 비율이 {r} 높았습니다", False,
              _ratio("kakao_night_n", "kakao_n", 10)),
    Indicator("kakao_len", "카톡 발화 길이", "kakao", "talk", "ratio",
              "카톡 한 번에 쓴 글이 {r} 짧았습니다", "카톡 한 번에 쓴 글이 {r} 길었습니다", False,
              _ratio("kakao_chars", "kakao_n", 10)),
    Indicator("kakao_delay", "카톡 답장 지연", "kakao", "talk", "ratio",
              "카톡 답장이 {r} 빨랐습니다", "카톡 답장이 {r} 늦었습니다", False,
              _ratio("kakao_reply_min_sum", "kakao_reply_n", 3)),
    Indicator("kakao_first", "카톡 1인칭 비율", "kakao", "talk", "ratio",
              "카톡에서 자기 이야기를 한 비율이 {r} 낮았습니다", "카톡에서 자기 이야기를 한 비율이 {r} 높았습니다", False,
              _ratio("kakao_first_n", "kakao_n", 10)),
    Indicator("kakao_assert", "카톡 단정어 비율", "kakao", "talk", "ratio",
              "카톡에서 단정하는 말의 비율이 {r} 낮았습니다", "카톡에서 단정하는 말의 비율이 {r} 높았습니다", False,
              _ratio("kakao_assert_n", "kakao_n", 10)),
    # 원페이지 02절 "SNS·AI 대화 연동": 인스타그램 내보내기, ChatGPT·Claude 대화 내보내기(원문은 저장하지 않고 개수만)
    Indicator("sns_post", "인스타그램 게시 수", "sns", "lang", "count",
              "인스타그램에 {r} 적게 올렸습니다", "인스타그램에 {r} 많이 올렸습니다", False, _sum("sns_post_n")),
    Indicator("sns_dm", "인스타그램 DM 수", "sns", "talk", "count",
              "인스타그램 DM을 {r} 적게 보냈습니다", "인스타그램 DM을 {r} 많이 보냈습니다", False, _sum("sns_dm_n")),
    Indicator("sns_night", "인스타그램 새벽 DM 비율", "sns", "talk", "ratio",
              "새벽에 보낸 DM의 비율이 {r} 낮았습니다", "새벽에 보낸 DM의 비율이 {r} 높았습니다", False,
              _ratio("sns_dm_night_n", "sns_dm_n", 5)),
    Indicator("ai_msg", "AI 대화 메시지 수", "ai", "lang", "count",
              "AI와 {r} 적게 대화했습니다", "AI와 {r} 많이 대화했습니다", False, _sum("ai_msg_n")),
    Indicator("ai_night", "AI 대화 새벽 비율", "ai", "lang", "ratio",
              "새벽에 AI와 나눈 대화의 비율이 {r} 낮았습니다", "새벽에 AI와 나눈 대화의 비율이 {r} 높았습니다", False,
              _ratio("ai_msg_night_n", "ai_msg_n", 5)),
    Indicator("ai_len", "AI에게 쓴 글 길이", "ai", "lang", "ratio",
              "AI에게 쓴 글이 {r} 짧았습니다", "AI에게 쓴 글이 {r} 길었습니다", False,
              _ratio("ai_chars", "ai_msg_n", 3)),
]

BY_ID = {i.id: i for i in INDICATORS}

# 채널마다 주 단위 '기록 건수'로 쓰는 필드(구조적 결측을 찾을 때 0 연속 길이를 이 값으로 잰다)
CHANNEL_COUNT_FIELDS = {
    "memo": ["memo_n"],
    "photo": ["photo_n"],
    "yt": ["yt_watch_n", "yt_search_n"],
    "cal": ["cal_n"],
    "kakao": ["kakao_n"],
    "sns": ["sns_post_n", "sns_dm_n"],
    "ai": ["ai_msg_n"],
    "git": ["git_commits"],
}
# 개수가 아니라 값이 있는 날 수로 관측 여부를 보는 계열과 그 날 수 필드
DAY_FAMILIES = {"health": ["steps_days", "sleep_days"], "quiet": ["quiet_days"], "screen": ["screen_days"]}
# 건강은 개수가 아니라 수준 값이라, 키가 있는 날 수로 관측 여부를 본다
HEALTH_DAY_FIELDS = {"steps": "steps_days", "sleep_min": "sleep_days", "quiet_min": "quiet_days", "screen_min": "screen_days"}

DAILY_SUM_FIELDS = [
    "steps", "sleep_min", "quiet_min", "screen_min", "git_commits",
    "memo_n", "memo_chars", "memo_night_n",
    "photo_n", "photo_night_n", "shot_n", "shot_night_n",
    "yt_watch_n", "yt_watch_night_n", "yt_search_n",
    "cal_n",
    "kakao_n", "kakao_night_n", "kakao_chars", "kakao_reply_n", "kakao_reply_min_sum",
    "kakao_first_n", "kakao_assert_n",
    "sns_post_n", "sns_dm_n", "sns_dm_night_n",
    "ai_msg_n", "ai_msg_night_n", "ai_chars",
]

FIELD_CHANNEL = {
    "steps": "health", "sleep_min": "health", "quiet_min": "quiet", "screen_min": "screen", "git_commits": "git",
    **{f: "memo" for f in ["memo_n", "memo_chars", "memo_night_n"]},
    **{f: "photo" for f in ["photo_n", "photo_night_n", "shot_n", "shot_night_n"]},
    **{f: "yt" for f in ["yt_watch_n", "yt_watch_night_n", "yt_search_n"]},
    "cal_n": "cal",
    **{f: "kakao" for f in ["kakao_n", "kakao_night_n", "kakao_chars", "kakao_reply_n", "kakao_reply_min_sum",
                            "kakao_first_n", "kakao_assert_n"]},
    **{f: "sns" for f in ["sns_post_n", "sns_dm_n", "sns_dm_night_n"]},
    **{f: "ai" for f in ["ai_msg_n", "ai_msg_night_n", "ai_chars"]},
}
`,"../../../core/mined_core/judge.py":`"""주 단위 판정 v7.

- 백분위: 그 주 자신의 직전 window 주(변화점 재시작이 켜져 있으면 마지막 변화점 이후)에서 관측된 주만으로
  중간 순위 백분위를 계산한다. 같은 값은 가운데 순위를 받으므로 0이 대부분인 지표에서 0인 주가 0%나 88%로 튀지 않는다.
- 배지: 백분위가 q_badge 이하(적은 쪽) 또는 1-q_badge 이상(많은 쪽).
- 판정(candidate): 배지 2개 이상. single_extreme_candidate 를 켜면 직전 기준 전체를 넘어선 배지(extreme=2) 1개도 판정.
- 교차검증: 배지가 서로 다른 계열(파일·측정 과정) 2개 이상에서 나왔을 때.
- 지표(metric): mid_rank_pct(기본, 위 백분위) 또는 robust_z(팀 v6: 중앙값·MAD, MAD=0 이면 평균절대편차×1.2533).
  robust_z 에서는 축 × 방향마다 다른 문턱 tau 를 쓴다. 두 지표 모두 추세 보정 필터(pr_dt)는 같은 방식으로 건다.
- 확인 등급(grade, 팀 9/23 확정): 판정 뒤 tier_horizon 주 안에 '평소' 주로 돌아오면 그 주가 return_week,
  그 뒤 tier_run 주(hold_until 까지)가 평소 범위면 held, 그 안에서 다시 벗어나면 broken, 기록이 비거나 아직
  안 지나서 모르면 returned. 돌아오지 않은 채 창이 닫히면 not_returned, 창이 안 닫혔으면 open,
  판정 창의 기록이 tier_min_obs 비율보다 적으면 insufficient. not_returned 의 화면 문장은 팀이 쓴다.
- 확인 후 열람: 두드러짐 점수(extreme=2 는 2점, extreme=1 은 1점)의 합이 2 이상.

팀의 v6 규칙과 기준값이 다르면 DEFAULT_CONFIG 만 바꾸면 된다.
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .indicators import AXIS_LABEL, BY_ID, FAMILY_LABEL, INDICATORS

DEFAULT_CONFIG = {
    "window": 52,
    "min_base": 26,
    "q_badge": 0.03,  # 합성 데이터 비교(docs/eval.md): 0.05 면 사건 없는 주의 23~35% 가 우연히 판정됨
    "q_extreme": 0.015,
    "adaptive_q": True,  # 관측 지표가 q_ref_m 개보다 많은 주는 우연 겹침 확률이 같아지도록 배지 기준을 조인다
    "q_ref_m": 11,
    "detrend": True,  # 직전 창 추세로 설명되는 배지는 떼어 낸다(배지 문장의 순위는 원래 값 기준 그대로)
    "q_trend": 0.10,
    "single_extreme_candidate": False,  # 켜면 배지 하나짜리 극단 주도 판정(우연 판정률 +15%p 안팎)
    "zero_share_down_off": 0.5,
    "gap_detection": True,
    "cp_restart": False,
    "cp_k": 3.0,
    "cp_deseason": True,  # 시기 경계를 찾기 전에 연 주기 성분을 뺀다
    "era_strong_shift": 1.5,  # 한 계열만 바뀐 변화도 앞뒤 반년 평균 차이가 잡음의 이 배수 이상이면 시기 경계
    "cp_min_size": 8,
    "episode_gap": 2,  # 판정된 주 사이가 이 주 수 이하면 한 에피소드
    "metric": "mid_rank_pct",  # 'mid_rank_pct' | 'robust_z' — 같은 평가 도구로 두 지표를 비교하려고 뽑아 둔 스위치
    "q_dir": None,  # mid_rank_pct 의 방향별 배지 기준. 예: {"move": {"up": 0.03, "down": 0.05}, ...}. 없으면 q_badge
    "tau": None,  # robust_z 의 축 × 방향 문턱(|z|). 없으면 TEAM_V6_TAU
    "band": 1.0,  # 결(줄무늬)과 robust_z 의 '평소' 판정에 쓰는 밴드 |z| < band
    "tier_horizon": 4,  # 팀 규칙: 4주 안에 돌아오는지
    "tier_run": 4,  # 팀 규칙: 돌아온 뒤 4주가 평소 범위인지
    "tier_normal": None,  # '평소' 주 판정: 'no_badge'(배지 없음) | 'band'(|z| < band). None 이면 metric 에 맞춰 고른다
    # 판정 창(horizon) 안에서 관측된 주 비율이 이보다 낮으면 not_returned 대신 insufficient.
    # scripts/insufficient_sweep.py: 0.5 면 공백 낀 not_returned 29주 중 19주가 거짓(원래 기록에선 돌아옴), 1.0 이면 8주 중 1주
    "tier_min_obs": 1.0,
    "complex_min_axes": 3,
    # 배지(판정 근거)로 쓰지 않는 지표. 밤 기록 공백은 실기록에서 수면과 얼마나 맞는지(평가 보고서 quiet_vs_sleep)
    # 확인하기 전까지 쉼 게이지·결에만 쓴다. 확인되면 [] 로 바꾼다
    "badge_off": ["quiet"],  # 배지가 이 수 이상의 축에 걸치면 광물을 형석(복합)으로  # 판정 창(horizon) 안에서 관측된 주 비율이 이보다 낮으면 insufficient
    "similar_exclude": 8,
    "similar_top": 5,  # 팀 NOW「닮은 주 k=5」
    "similar_min_families": 2,
    "similar_min_shared": 3,
    "null_iter": 200,  # 요약에 '우연이라면 몇 주'를 넣는 원형 이동 반복 수(0 이면 생략)
    "auto_link": True,  # 계열이 달라도 이 사람 기록에서 |ρ| ≥ link_rho 로 함께 움직이는 지표는 근거 하나로 센다
    "link_rho": 0.6,
    "link_min_weeks": 52,
    "family_merge": None,  # 예: {"yt": "screen", "photo": "screen"} 처럼 계열을 묶어 셀 때
}

# 광물 9종: 지표 × 방향 8종 + 교차검증 1종(형석). 난수가 아니라 같은 데이터면 같은 광물이 나온다.
# 10/23 보경: 광물 이름은 「예시 이름」이다. 이름은 사용자가 붙이고, 앱은 처음 이름만 제안한다(화면 문구는 웹 쪽).
MINERAL_BY_AXIS_DIR = {
    ("move", "up"): "호박", ("move", "down"): "황철석",
    ("rest", "up"): "청금석", ("rest", "down"): "월장석",
    ("lang", "up"): "자수정", ("lang", "down"): "홍옥",
    ("talk", "up"): "흑요석", ("talk", "down"): "석류석",
}
MINERAL_COMPLEX = "형석"
MINERAL_EN = {"호박": "amber", "황철석": "pyrite", "청금석": "lapis", "월장석": "moonstone", "자수정": "amethyst",
              "홍옥": "rose", "흑요석": "obsidian", "석류석": "garnet", "형석": "fluorite"}
# 팀 v6 실측 τ(800주 실기록, 9/23 §1-3). 건수형 지표는 오른쪽 꼬리가 길어 위·아래 문턱이 다르다.
# ⚠ lang·talk 는 10/23 이전 남기기(leave) 축의 τ 를 임시로 옮겨 썼다. 실기록으로 다시 재야 한다
#   (pipeline/gyeol_kit/calibrate_axes.py, 기기 안에서만). 기본 metric(mid_rank_pct)은 τ 를 쓰지 않는다.
TEAM_V6_TAU = {
    "move": {"up": 4.91, "down": 1.60},
    "rest": {"up": 2.21, "down": 2.99},
    "lang": {"up": 2.85, "down": 1.37},  # 임시
    "talk": {"up": 2.85, "down": 1.37},  # 임시
}
GRADES = ["held", "returned", "open", "insufficient", "broken", "not_returned"]
# 화면 문장(팀 확정, broken 은 10/2 NOW). None 은 팀이 문안을 정할 때까지 아무것도 붙이지 않는다는 뜻이다.
GRADE_TEXT = {
    "held": "그 뒤 {run}주는 평소 범위였습니다.",
    "returned": "돌아왔지만 그 뒤는 확인되지 않았습니다.",
    "open": "이 주 뒤는 아직 확인되지 않았습니다.",
    "insufficient": "기록이 비어 판정할 수 없습니다.",
    "broken": "돌아왔지만 다시 벗어났습니다.",
    "not_returned": None,
}
ORDINAL = ["", "", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"]


def _detrended(b_idx: np.ndarray, b: np.ndarray, w: int, x: float) -> tuple[np.ndarray, float]:
    """직전 창 안에서 선형 추세를 빼고, 그 추세를 w 주까지 늘린 값과 x 의 차이를 돌려준다.

    OLS 로 한 번 맞춘 뒤 잔차가 2σ 를 넘는 주(판정된 주 같은 이상치)를 빼고 다시 맞춘다.
    과거 주만 쓰므로 인과적이다. 추세가 없으면 원래 롤링 백분위와 거의 같다.
    """
    t = b_idx.astype(float)
    A = np.column_stack([np.ones_like(t), t])
    coef, *_ = np.linalg.lstsq(A, b, rcond=None)
    r = b - A @ coef
    s = np.std(r)
    if s > 0:
        keep = np.abs(r) <= 2 * s
        if keep.sum() >= 8:
            coef, *_ = np.linalg.lstsq(A[keep], b[keep], rcond=None)
    fit_b = A @ coef
    fit_w = coef[0] + coef[1] * w
    return b - fit_b, x - fit_w


def rolling_percentile(v: np.ndarray, window: int, min_base: int, cps: list[int] | None = None,
                       detrend: bool = False, log: bool = False):
    n = len(v)
    pr = np.full(n, np.nan)
    pr_dt = np.full(n, np.nan)
    nb = np.zeros(n, dtype=int)
    less_a = np.zeros(n, dtype=int)
    eq_a = np.zeros(n, dtype=int)
    gr_a = np.zeros(n, dtype=int)
    zs = np.zeros(n)
    rz = np.full(n, np.nan)
    why: list[str | None] = [None] * n
    cps_sorted = sorted(cps or [])
    j = 0
    cur = 0
    idx_all = np.arange(n)
    for w in range(n):
        while j < len(cps_sorted) and cps_sorted[j] <= w:
            cur = cps_sorted[j]
            j += 1
        x = v[w]
        s = max(0, w - window)
        if cps_sorted:
            s = max(s, cur)
        seg = v[s:w]
        ok = ~np.isnan(seg)
        b = seg[ok]
        nb[w] = len(b)
        if np.isnan(x):
            why[w] = "missing"
            continue
        if len(b) < min_base:
            why[w] = "baseline_short"
            continue
        less = int(np.sum(b < x))
        eq = int(np.sum(b == x))
        gr = len(b) - less - eq
        pr[w] = (less + 0.5 * eq) / len(b)
        less_a[w], eq_a[w], gr_a[w] = less, eq, gr
        zs[w] = float(np.mean(b == 0))
        rz[w] = robust_z(b, float(x))
        if detrend and zs[w] < 0.5:
            bt = np.log1p(b) if log else b
            xt = float(np.log1p(x)) if log else float(x)
            rb, rx = _detrended(idx_all[s:w][ok], bt, w, xt)
            pr_dt[w] = (np.sum(rb < rx) + 0.5 * np.sum(rb == rx)) / len(rb)
        else:
            pr_dt[w] = pr[w]
    return {"pr": pr, "pr_dt": pr_dt, "n_base": nb, "less": less_a, "eq": eq_a, "gr": gr_a, "zero_share": zs, "z": rz, "why": why}


def robust_z(b: np.ndarray, x: float, cap: float = 10.0) -> float:
    """팀 v6 robust z: (x - 중앙값) / (1.4826·MAD). MAD 가 0 이면 평균절대편차 × 1.2533(Iglewicz–Hoaglin).

    둘 다 0(기준 창이 전부 같은 값)이면 같은 값은 0, 다른 값은 ±cap 으로 둔다.
    """
    med = float(np.median(b))
    dev = np.abs(b - med)
    mad = float(np.median(dev))
    scale = 1.4826 * mad if mad > 0 else 1.2533 * float(np.mean(dev))
    if scale <= 0:
        return 0.0 if x == med else (cap if x > med else -cap)
    return float(np.clip((x - med) / scale, -cap, cap))


def rank_phrase(rank: int, n: int) -> str:
    if rank == 1:
        return f"직전 {n}주 중 가장"
    if rank <= 10:
        return f"직전 {n}주 중 {ORDINAL[rank]} 번째로"
    return f"직전 {n}주 중 {rank}번째로"


def _p_two_or_more(m: int, p: float) -> float:
    """지표 m 개가 서로 독립이고 각각 확률 p 로 배지를 받을 때, 배지가 2개 이상 나올 확률."""
    return 1 - (1 - p) ** m - m * p * (1 - p) ** (m - 1)


def adaptive_q(m_obs: int, cfg: dict) -> float:
    """관측된 지표가 기준(q_ref_m 개)보다 많으면, 우연히 배지 2개가 겹칠 확률이 기준과 같아지도록 배지 기준을 조인다.

    지표가 기준보다 적으면 q_badge 를 그대로 쓴다(느슨하게 풀지 않음). 지표끼리 독립이라고 가정한 근사다.
    """
    q0 = cfg["q_badge"]
    ref = int(cfg.get("q_ref_m", 11))
    if not cfg.get("adaptive_q", True) or m_obs <= ref:
        return q0
    target = _p_two_or_more(ref, 2 * q0)
    lo, hi = 1e-4, 2 * q0
    for _ in range(40):
        mid = (lo + hi) / 2
        if _p_two_or_more(m_obs, mid) > target:
            hi = mid
        else:
            lo = mid
    return max(0.005, lo / 2)


def thresholds(axis: str, m_obs: int, cfg: dict) -> tuple[float, float]:
    """(위, 아래) 문턱. mid_rank_pct 는 백분위 꼬리 비율 q, robust_z 는 |z| 문턱 τ 를 돌려준다.

    mid_rank_pct 의 방향별 q 는 adaptive_q 가 조인 비율(조인 q / q_badge)만큼 같이 조인다.
    """
    if cfg.get("metric", "mid_rank_pct") == "robust_z":
        t = (cfg.get("tau") or TEAM_V6_TAU)[axis]
        return float(t["up"]), float(t["down"])
    scale = adaptive_q(m_obs, cfg) / cfg["q_badge"]
    qd = (cfg.get("q_dir") or {}).get(axis)
    if not qd:
        return cfg["q_badge"] * scale, cfg["q_badge"] * scale
    return float(qd["up"]) * scale, float(qd["down"]) * scale


def make_badges(w: int, P: dict[str, dict], cfg: dict) -> list[dict]:
    out = []
    m_obs = sum(1 for ind in INDICATORS if not np.isnan(P[ind.id]["pr"][w]))
    qx = cfg["q_extreme"]
    use_z = cfg.get("metric", "mid_rank_pct") == "robust_z"
    off = set(cfg.get("badge_off") or [])
    for ind in INDICATORS:
        if ind.id in off or ind.axis is None:
            continue
        R = P[ind.id]
        p = R["pr"][w]
        if np.isnan(p):
            continue
        pd = R["pr_dt"][w]
        qd = cfg["q_trend"]
        t_up, t_down = thresholds(ind.axis, m_obs, cfg)
        if use_z:
            z = R["z"][w]
            hit_up, hit_down = z >= t_up, z <= -t_down
        else:
            hit_up, hit_down = p >= 1 - t_up, p <= t_down
        up = hit_up and pd >= 1 - qd
        down = hit_down and pd <= qd and R["zero_share"][w] < cfg["zero_share_down_off"]
        if not (up or down):
            continue
        less, eq, gr = int(R["less"][w]), int(R["eq"][w]), int(R["gr"][w])
        rank = gr + 1 if up else less + 1
        strict = (gr == 0 and eq == 0) if up else (less == 0 and eq == 0)
        extreme = 2 if strict else (1 if (p >= 1 - qx or p <= qx) else 0)
        out.append({
            "indicator": ind.id, "label": ind.label, "family": ind.family, "axis": ind.axis,
            "direction": "up" if up else "down", "pr": round(float(p), 4), "rank": rank,
            "n_base": int(R["n_base"][w]), "extreme": extreme, "z": round(float(R["z"][w]), 3),
        })
    out.sort(key=lambda b: (-b["extreme"], -abs(b["pr"] - 0.5)))
    return out


def pick_sentence_badges(badges: list[dict]) -> list[dict]:
    if not badges:
        return []
    first = badges[0]
    other = next((b for b in badges[1:] if b["family"] != first["family"]), None)
    if other is None and len(badges) > 1:
        other = badges[1]
    return [first] + ([other] if other else [])


def grade_sequence(obs: list[bool], normal: list[bool], horizon: int, run: int, upto: int,
                   min_obs: float = 1.0) -> tuple[str, int | None, int | None]:
    """판정 주 뒤의 주들로 확인 등급을 정한다. obs[k]·normal[k] 는 판정 주에서 k+1 주 뒤의 관측 여부·평소 여부.

    upto 주 뒤까지만 안다고 보고 계산한다. 돌려주는 것은 (등급, 돌아온 주 오프셋, 지속 창 끝 오프셋).
    - horizon 주 안에 첫 평소 주(return)가 있으면 그 뒤 run 주를 본다: 하나라도 벗어나면 broken,
      전부 평소면 held, 비었거나 아직 안 지났으면 returned.
    - 돌아오지 않았는데 horizon 이 안 지났으면 open, 지났으면 관측 주가 min_obs·horizon 보다 적을 때 insufficient,
      아니면 not_returned.
    """
    r = None
    n_obs = 0
    for k in range(1, min(upto, horizon) + 1):
        if k - 1 >= len(obs) or not obs[k - 1]:
            continue
        n_obs += 1
        if normal[k - 1]:
            r = k
            break
    if r is None:
        if upto < horizon:
            return "open", None, None
        return ("insufficient" if n_obs < min_obs * horizon else "not_returned"), None, None
    hold = r + run
    missing = False
    for k in range(r + 1, min(upto, hold) + 1):
        if k - 1 >= len(obs) or not obs[k - 1]:
            missing = True
        elif not normal[k - 1]:
            return "broken", r, hold
    if upto >= hold and not missing:
        return "held", r, hold
    return "returned", r, hold


def grade_text(grade: str | None, run: int = 4) -> str | None:
    t = GRADE_TEXT.get(grade) if grade else None
    return t.format(run=run) if t else None


def sentence_for(monday: dt.date, badges: list[dict], grade: str | None, run: int, cross: bool,
                 linked: bool = False, plain: bool = False) -> str:
    """판정 문장. plain 이면 순위(「직전 52주 중 가장」) 대신 「평소보다」로 쓴 첫 화면용 문장을 만든다(9/12 회의 5번:
    수치는 「왜 이 주인가」 안으로 접는다). 근거가 얇다는 덧붙임도 plain 에서는 뺀다."""
    head = f"{monday.year}년 {monday.month}월 {monday.day}일부터 한 주간, "
    parts = []
    for i, b in enumerate(pick_sentence_badges(badges)):
        ind = BY_ID[b["indicator"]]
        r = "평소보다" if plain else rank_phrase(b["rank"], b["n_base"])
        frag = (ind.up if b["direction"] == "up" else ind.down).format(r=r)
        parts.append(frag + "." if i == 0 else "그리고 " + frag + ".")
    s = head + " ".join(parts)
    gt = grade_text(grade, run)
    if gt:
        s += " " + gt
    if plain:
        return s
    if not cross and badges:
        fams = sorted({b["family"] for b in badges})
        if linked and len(fams) >= 2:
            names = "·".join(FAMILY_LABEL[f] for f in fams)
            s += f" {names} 기록이 함께 가리켰지만, 이 기록에서는 늘 함께 움직이는 지표라 근거 하나로 셌습니다. 근거가 얇습니다."
        else:
            fam = FAMILY_LABEL[badges[0]["family"]]
            s += f" 이 판정은 {fam} 기록 한 종류에서만 나왔습니다. 근거가 얇습니다."
    return s


def mineral_shape(badges: list[dict], complex_min_axes: int = 3) -> tuple[str | None, str | None]:
    """광물: 가장 강한 배지의 축 × 방향(8종). 배지가 complex_min_axes 개 이상의 축에 걸치면 형석(복합).

    팀 정의 GEM_COMPLEX 는 「교차검증」인데, 이 코어는 배지 2개 이상이어야 판정하므로 판정 주 대부분이
    교차검증이 된다(합성 인물 long 87주 중 83주). 그대로 따르면 형석이 95%가 되어 축 × 방향 정보가 사라지므로,
    팀 정의를 받기 전까지는 「3축 이상」을 복합으로 둔다(long 13주, 15%). 팀 규칙이 정해지면 이 함수만 바꾼다.
    모양은 방향 구성(모두 위 angular · 모두 아래 round · 섞임 diamond)."""
    if not badges:
        return None, None
    b0 = badges[0]
    n_axes = len({b["axis"] for b in badges})
    mineral = MINERAL_COMPLEX if n_axes >= complex_min_axes else MINERAL_BY_AXIS_DIR[(b0["axis"], b0["direction"])]
    dirs = {b["direction"] for b in badges}
    shape = "angular" if dirs == {"up"} else ("round" if dirs == {"down"} else "diamond")
    return mineral, shape


AXIS_GAUGE = {"move": ["steps"], "rest": ["sleep", "quiet"], "lang": ["memo_n", "ai_msg"],
              "talk": ["kakao_n", "sns_dm"]}


def axes_for(w: int, P: dict[str, dict]) -> dict:
    """4축 게이지. pr·z 모두 축 안 게이지 지표 값의 중앙값(z 는 결 계산에 쓴다).
    쉼 축은 수면 기록이 있으면 수면만, 없을 때만 밤 기록 공백을 쓴다(둘을 섞지 않는다)."""
    out = {}
    for ax, ids in AXIS_GAUGE.items():
        used = [i for i in ids if not np.isnan(P[i]["pr"][w])]
        if ax == "rest":
            used = used[:1]
        vals = [(P[i]["pr"][w], P[i]["n_base"][w], P[i]["z"][w]) for i in used]
        if not vals:
            out[ax] = None
            continue
        z = float(np.median([v[2] for v in vals]))
        out[ax] = {"pr": round(float(np.median([v[0] for v in vals])), 4), "n_base": int(max(v[1] for v in vals)),
                   "z": round(float(z), 3)}
        if ax == "rest" and used == ["quiet"]:
            out[ax]["via"] = "quiet"
    return out


def gyeol_for(axes: dict, band: float = 1.0) -> str | None:
    """결(줄무늬, 팀 9/15): 밴드 |z| < band 밖에 있는 축 수로 mixed(2축 이상)·coarse(1축)·regular(0축).
    광물(얼마나 드문가)과 따로 계산한다. 관측된 축이 없으면 None."""
    zs = [a["z"] for a in axes.values() if a is not None]
    if not zs:
        return None
    out_n = sum(1 for z in zs if abs(z) >= band)
    return "mixed" if out_n >= 2 else ("coarse" if out_n == 1 else "regular")


__all__ = ["DEFAULT_CONFIG", "rolling_percentile", "make_badges", "sentence_for", "mineral_shape", "axes_for",
           "gyeol_for", "grade_sequence", "grade_text", "robust_z", "rank_phrase", "AXIS_LABEL", "GRADES", "TEAM_V6_TAU"]
`,"../../../core/mined_core/run.py":`"""판정 파이프라인 전체: 일 단위 표 + 채널 메타 → 주 레코드 v7 목록.

CPython CLI 와 브라우저 Pyodide 가 이 함수를 그대로 부른다(run_json).
"""
from __future__ import annotations

import datetime as dt
import json
import math

import numpy as np

from .changepoint import changepoints_with_gaps, deseasonalize, strong_shift
from .coverage import coverage_masks
from .indicators import BY_ID, DERIVED_FAMILIES, FAMILIES, INDICATORS
from .judge import (DEFAULT_CONFIG, GRADES, axes_for, grade_sequence, gyeol_for, make_badges, mineral_shape,
                    rolling_percentile, sentence_for)
from .weeks import build_weeks, iso_key

SCHEMA_WEEK = "mined.week/8"
SCHEMA_RESULT = "mined.result/8"


def _r(x, nd=4):
    if x is None:
        return None
    if isinstance(x, float) and math.isnan(x):
        return None
    return round(float(x), nd)


def indicator_arrays(weeks: list[dict], masks: dict[str, list[str]]):
    n = len(weeks)
    V: dict[str, np.ndarray] = {}
    WHY: dict[str, list[str | None]] = {}
    for ind in INDICATORS:
        arr = np.full(n, np.nan)
        why: list[str | None] = [None] * n
        m = masks[ind.family]
        for w in range(n):
            if m[w] != "observed":
                why[w] = "missing"
                continue
            val = ind.compute(weeks[w])
            if val is None:
                why[w] = "no_denominator"
                continue
            arr[w] = val
        V[ind.id] = arr
        WHY[ind.id] = why
    return V, WHY


def consensus_boundaries(CP: dict[str, list[int]], tol: int = 4, min_families: int = 2,
                         DS: dict[str, np.ndarray] | None = None, strong: float = 1.5):
    pts = sorted((c, BY_ID[i].family, i) for i, cs in CP.items() for c in cs)
    clusters: list[dict] = []
    for c, f, i in pts:
        if clusters and c - clusters[-1]["last"] <= tol:
            clusters[-1]["items"].append((c, f, i))
            clusters[-1]["last"] = c
        else:
            clusters.append({"items": [(c, f, i)], "last": c})
    out = []
    for cl in clusters:
        fams = {f for _, f, _ in cl["items"]}
        at = int(np.median([c for c, _, _ in cl["items"]]))
        ids = sorted({i for _, _, i in cl["items"]})
        if len(fams) >= min_families:
            out.append((at, ids))
        elif DS is not None and any(strong_shift(DS[i], c) >= strong for c, _, i in cl["items"]):
            # 한 계열만 바뀌어도 앞뒤 반년 평균이 잡음의 strong 배 이상 차이 나면 경계로 본다(예: 기기 교체)
            out.append((at, ids))
    return out


def build_eras(n: int, mondays: list[dt.date], bounds, candidate: list[bool], min_len: int = 13):
    cuts = [b for b, _ in bounds if 0 < b < n]
    why = {b: ids for b, ids in bounds}
    segs = []
    start = 0
    for c in cuts:
        if c - start < min_len:
            continue
        segs.append((start, c))
        start = c
    segs.append((start, n))
    if len(segs) > 1 and segs[-1][1] - segs[-1][0] < min_len:
        a, _ = segs[-2]
        segs = segs[:-2] + [(a, n)]
    eras = []
    for k, (a, b) in enumerate(segs):
        eras.append({
            "id": f"era-{k + 1:02d}",
            "start": mondays[a].isoformat(),
            "end": (mondays[b - 1] + dt.timedelta(days=6)).isoformat(),
            "start_index": a, "end_index": b,
            "boundary_indicators": why.get(a, []),
            "n_weeks": b - a,
            "n_candidates": int(sum(candidate[a:b])),
        })
    return eras


def similar_weeks(w: int, M: np.ndarray, fam_onehot: np.ndarray, ids: list[str], cfg: dict):
    hi = w - cfg["similar_exclude"]
    if hi <= 0:
        return []
    x = M[w]
    X = M[:hi]
    both = (~np.isnan(X)) & (~np.isnan(x))[None, :]
    cnt = both.sum(1)
    fam_cnt = ((both.astype(int) @ fam_onehot) > 0).sum(1)
    diff = np.where(both, np.abs(np.nan_to_num(X) - np.nan_to_num(x)[None, :]), 0.0)
    dist = diff.sum(1) / np.maximum(cnt, 1)
    ok = (cnt >= cfg["similar_min_shared"]) & (fam_cnt >= cfg["similar_min_families"])
    idx = np.where(ok)[0]
    if len(idx) == 0:
        return []
    order = idx[np.argsort(dist[idx], kind="stable")]
    picked: list[int] = []
    for u in order:
        if all(abs(int(u) - p) >= 4 for p in picked):
            picked.append(int(u))
        if len(picked) >= cfg["similar_top"]:
            break
    out = []
    for u in picked:
        same = []
        for k, iid in enumerate(ids):
            a, b = x[k], M[u, k]
            if np.isnan(a) or np.isnan(b):
                continue
            if a >= 0.8 and b >= 0.8:
                same.append(f"{iid}:up")
            elif a <= 0.2 and b <= 0.2:
                same.append(f"{iid}:down")
        out.append({"index": u, "distance": _r(dist[u]), "shared_families": int(fam_cnt[u]), "same_direction": same})
    return out


def run(daily: list[dict], meta: dict | None = None, config: dict | None = None) -> dict:
    meta = meta or {}
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    mondays, weeks, ranges = build_weeks(daily, meta)
    n = len(weeks)
    if n == 0:
        return {"schema": SCHEMA_RESULT, "config": cfg, "weeks": [], "eras": [], "episodes": [], "summary": {"n_weeks": 0}}
    masks, cov_info = coverage_masks(mondays, weeks, meta, cfg.get("gap_detection", True))
    V, WHY = indicator_arrays(weeks, masks)
    woy = [m.isocalendar()[1] for m in mondays]
    CP = {ind.id: changepoints_with_gaps(V[ind.id], ind.kind, cfg["cp_k"], cfg["cp_min_size"],
                                         woy if cfg.get("cp_deseason", True) else None) for ind in INDICATORS}
    # 강한 단일 변화(효과 크기)도 시기 경계 후보로 쓰기 위해 계절을 뺀 수열을 남긴다
    DS = {}
    for ind in INDICATORS:
        v = np.log1p(V[ind.id]) if ind.kind == "count" else V[ind.id].astype(float)
        DS[ind.id] = deseasonalize(v, woy) if cfg.get("cp_deseason", True) else v
    P: dict[str, dict] = {}
    for ind in INDICATORS:
        R = rolling_percentile(V[ind.id], cfg["window"], cfg["min_base"], CP[ind.id] if cfg["cp_restart"] else None,
                               detrend=cfg["detrend"], log=(ind.kind == "count"))
        for w in range(n):
            if WHY[ind.id][w]:
                R["why"][w] = WHY[ind.id][w]
        P[ind.id] = R

    badges = [make_badges(w, P, cfg) for w in range(n)]
    candidate = [len(b) >= 2 or (cfg["single_extreme_candidate"] and any(x["extreme"] == 2 for x in b)) for b in badges]
    merge = cfg.get("family_merge") or {}

    # 멘토 질문 ②: 이 사람 기록에서 계열이 달라도 함께 움직이는 지표 쌍(|ρ| ≥ link_rho)은 근거 하나로 센다.
    # 파일 단위 규칙(측정 오류가 겹치는 범위)은 그대로 두고, 같은 정보를 두 번 세는 것만 막는다.
    ids_all = [i.id for i in INDICATORS]
    PRM = np.column_stack([P[i]["pr"] for i in ids_all])
    linked: dict[tuple[str, str], float] = {}
    if cfg.get("auto_link", True):
        thr = float(cfg.get("link_rho", 0.6))
        min_n = int(cfg.get("link_min_weeks", 52))
        for a in range(len(ids_all)):
            for b in range(a + 1, len(ids_all)):
                ia, ib = ids_all[a], ids_all[b]
                if BY_ID[ia].family == BY_ID[ib].family:
                    continue
                m = ~np.isnan(PRM[:, a]) & ~np.isnan(PRM[:, b])
                if m.sum() < min_n:
                    continue
                x, y = PRM[m, a], PRM[m, b]
                if x.std() == 0 or y.std() == 0:
                    continue
                r = float(np.corrcoef(x, y)[0, 1])
                if abs(r) >= thr:
                    linked[(ia, ib)] = linked[(ib, ia)] = round(r, 3)

    def groups_of(bs):
        """배지를 근거 묶음으로 나눈다: 같은 계열(또는 family_merge)이거나 함께 움직이는 지표 쌍이면 한 묶음."""
        parent = list(range(len(bs)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        fam = [merge.get(b["family"], b["family"]) for b in bs]
        for i in range(len(bs)):
            for j in range(i + 1, len(bs)):
                if fam[i] == fam[j] or (bs[i]["indicator"], bs[j]["indicator"]) in linked:
                    parent[find(i)] = find(j)
        comps: dict[int, set[str]] = {}
        for i in range(len(bs)):
            if bs[i]["family"] in DERIVED_FAMILIES:
                continue  # 다른 채널 시각에서 계산한 근거는 독립 근거 수에 넣지 않는다
            comps.setdefault(find(i), set()).add(fam[i])
        return sorted(sorted(c) for c in comps.values())

    def linked_in(bs):
        out = []
        for i in range(len(bs)):
            for j in range(i + 1, len(bs)):
                k = (bs[i]["indicator"], bs[j]["indicator"])
                if k in linked:
                    out.append({"a": k[0], "b": k[1], "rho": linked[k]})
        return out

    H, RUN = cfg["tier_horizon"], cfg["tier_run"]
    band = float(cfg.get("band", 1.0))
    normal_rule = cfg.get("tier_normal") or ("band" if cfg.get("metric") == "robust_z" else "no_badge")
    min_obs = float(cfg.get("tier_min_obs", 1.0))

    def observed(t: int, fams: set[str]) -> bool:
        return any(not np.isnan(P[i.id]["pr"][t]) for i in INDICATORS if i.family in fams)

    def is_normal(t: int, fams: set[str]) -> bool:
        """관측된 주에서만 부른다. no_badge: 판정되지 않았고 같은 계열 배지도 없음. band: 같은 계열 지표가 모두 |z| < band."""
        if normal_rule == "band":
            zs = [P[i.id]["z"][t] for i in INDICATORS if i.family in fams and not np.isnan(P[i.id]["pr"][t])]
            return bool(zs) and all(abs(z) < band for z in zs)
        if candidate[t]:
            return False
        return not any(b["family"] in fams for b in badges[t])

    def grade_as_of(w: int, t_end: int, fams: set[str]) -> tuple[str, int | None, int | None]:
        """(등급, 돌아온 주 index, 지속 창 끝 index). t_end 까지의 기록만 본다(그때 화면에 무엇이 나갔는지 재현)."""
        last = min(n - 1, w + H + RUN)
        obs = [observed(t, fams) for t in range(w + 1, last + 1)]
        nor = [o and is_normal(t, fams) for t, o in zip(range(w + 1, last + 1), obs)]
        g, r, h = grade_sequence(obs, nor, H, RUN, t_end - w, min_obs)
        return g, (None if r is None else w + r), (None if h is None else w + h)

    def week_key(idx: int) -> str:
        return iso_key(mondays[0] + dt.timedelta(weeks=idx))

    # 에피소드: 판정된 주 사이 간격이 episode_gap 주 이하면 하나의 이어진 변화로 묶는다(2주 이상일 때만)
    gap = int(cfg.get("episode_gap", 2))
    cand_idx = [w for w in range(n) if candidate[w]]
    groups: list[list[int]] = []
    for w in cand_idx:
        if groups and w - groups[-1][-1] <= gap:
            groups[-1].append(w)
        else:
            groups.append([w])
    episodes = []
    ep_of: list[str | None] = [None] * n
    for g in groups:
        if len(g) < 2:
            continue
        eid = f"ep-{len(episodes) + 1:03d}"
        fams = sorted({b["family"] for w in g for b in badges[w]})
        top = max((b for w in g for b in badges[w]), key=lambda b: (b["extreme"], abs(b["pr"] - 0.5)))
        episodes.append({
            "id": eid,
            "weeks": [iso_key(mondays[w]) for w in g],
            "date_start": mondays[g[0]].isoformat(),
            "date_end": (mondays[g[-1]] + dt.timedelta(days=6)).isoformat(),
            "span_weeks": g[-1] - g[0] + 1,
            "families": fams,
            "strongest": {"indicator": top["indicator"], "label": top["label"], "direction": top["direction"]},
        })
        for w in range(g[0], g[-1] + 1):
            ep_of[w] = eid

    bounds = consensus_boundaries(CP, DS=DS, strong=cfg.get("era_strong_shift", 1.5))
    eras = build_eras(n, mondays, bounds, candidate)
    for k, e in enumerate(eras):
        lv = {}
        for ind in INDICATORS:
            if not ind.gauge and ind.id not in ("memo_night", "yt_night"):
                continue
            seg = V[ind.id][e["start_index"]:e["end_index"]]
            seg = seg[~np.isnan(seg)]
            lv[ind.id] = None if len(seg) < 8 else round(float(np.median(seg)), 3)
        e["levels"] = lv
        if k > 0:
            prev = eras[k - 1]["levels"]
            ch = {}
            for i, x in lv.items():
                y = prev.get(i)
                if x is None or y is None:
                    continue
                floor = 0.05 if BY_ID[i].kind == "ratio" else 1.0
                if abs(y) >= floor:
                    r = (x - y) / abs(y)
                    if abs(r) >= 0.15:
                        ch[i] = {"from": y, "to": x, "ratio": round(r, 3)}
                elif abs(x) >= floor:
                    ch[i] = {"from": y, "to": x, "ratio": None}
            e["change_vs_prev"] = ch
    era_of = [None] * n
    for e in eras:
        for k in range(e["start_index"], e["end_index"]):
            era_of[k] = e["id"]

    ids = [i.id for i in INDICATORS]
    M = np.column_stack([P[i]["pr"] for i in ids])
    fam_onehot = np.zeros((len(ids), len(FAMILIES)), dtype=int)
    for k, i in enumerate(ids):
        fam_onehot[k, FAMILIES.index(BY_ID[i].family)] = 1
    last_obs = max((w for w in range(n) if not np.all(np.isnan(M[w]))), default=n - 1)
    sim_targets = set(w for w in range(n) if candidate[w]) | set(range(max(0, last_obs - 3), last_obs + 1))

    out_weeks = []
    grades_count = {g: 0 for g in GRADES}
    for w in range(n):
        mon = mondays[w]
        bs = badges[w]
        fams = {b["family"] for b in bs}
        groups = groups_of(bs)
        cross = len(groups) >= 2
        grade = None
        ret = hold = None
        history = []
        if candidate[w]:
            prev = None
            for t_end in range(w, min(n - 1, w + H + RUN) + 1):
                g, ret, hold = grade_as_of(w, t_end, fams)
                if g != prev:
                    history.append({"as_of": (mondays[t_end] + dt.timedelta(days=6)).isoformat(), "grade": g})
                    prev = g
                grade = g
            grades_count[grade] += 1
        score = sum(2 if b["extreme"] == 2 else (1 if b["extreme"] == 1 else 0) for b in bs)
        mineral, shape = mineral_shape(bs, int(cfg.get("complex_min_axes", 3))) if candidate[w] else (None, None)
        axes = axes_for(w, P)
        sim = []
        if w in sim_targets:
            for s in similar_weeks(w, M, fam_onehot, ids, cfg):
                u = s.pop("index")
                s["week"] = iso_key(mondays[u])
                sim.append(s)
        ind_out = {}
        for i in ids:
            R = P[i]
            p = R["pr"][w]
            ind_out[i] = {
                "v": _r(V[i][w], 3),
                "pr": _r(p),
                "n_base": int(R["n_base"][w]),
                "rank_low": None if np.isnan(p) else int(R["less"][w]) + 1,
                "rank_high": None if np.isnan(p) else int(R["gr"][w]) + 1,
                "why": R["why"][w],
            }
        out_weeks.append({
            "schema": SCHEMA_WEEK,
            "week": iso_key(mon),
            "date_start": mon.isoformat(),
            "date_end": (mon + dt.timedelta(days=6)).isoformat(),
            "candidate": bool(candidate[w]),
            "coverage": {ch: masks[ch][w] for ch in FAMILIES},
            "ind": ind_out,
            "axes": axes,
            "gyeol": gyeol_for(axes, band),
            "badges": bs if candidate[w] else bs,
            "evidence": {"families": sorted(fams), "independent": len(groups), "cross_validated": bool(cross and candidate[w]),
                         **({"linked": linked_in(bs)} if candidate[w] and linked_in(bs) else {})},
            "grade": grade,
            "grade_history": history,
            "return_week": week_key(ret) if ret is not None else None,
            "hold_until": week_key(hold) if hold is not None else None,
            "access": "confirm" if (candidate[w] and score >= 2) else "auto",
            "era": era_of[w],
            "episode": ep_of[w] if candidate[w] else None,
            "mineral": mineral,
            "shape": shape,
            "similar": sim,
            "sentence": sentence_for(mon, bs, grade, RUN, cross, bool(linked_in(bs))) if candidate[w] else None,
            "sentence_plain": sentence_for(mon, bs, grade, RUN, cross, plain=True) if candidate[w] else None,
        })

    n_cand = int(sum(candidate))
    n_cross = sum(1 for x in out_weeks if x["evidence"]["cross_validated"])
    summary = {
        "n_weeks": n,
        "first_week": iso_key(mondays[0]),
        "last_week": iso_key(mondays[-1]),
        "n_candidates": n_cand,
        "n_cross": n_cross,
        "n_single_source": n_cand - n_cross,
        "grades": grades_count,
        "n_confirm": sum(1 for x in out_weeks if x["access"] == "confirm"),
        "coverage": {ch: {"observed_weeks": cov_info[ch]["observed_weeks"],
                          "share": round(cov_info[ch]["observed_weeks"] / n, 3),
                          **{k: v for k, v in cov_info[ch].items() if k != "observed_weeks"}} for ch in FAMILIES},
        "changepoints": {i: [iso_key(mondays[c]) for c in cs] for i, cs in CP.items() if cs},
        "n_eras": len(eras),
        "linked_pairs": sorted(({"a": a, "b": b, "rho": r} for (a, b), r in linked.items() if a < b), key=lambda x: -abs(x["rho"])),
    }
    if cfg.get("null_iter"):
        from .validate import circular_null
        summary["cross_null"] = circular_null({"weeks": out_weeks}, n_iter=int(cfg["null_iter"]))
    for e in episodes:
        e["grade"] = next((x["grade"] for x in reversed(out_weeks) if x["week"] in set(e["weeks"])), None)
    summary["n_episodes"] = len(episodes)
    return {"schema": SCHEMA_RESULT, "config": cfg, "weeks": out_weeks, "eras": eras, "episodes": episodes, "summary": summary}


def run_json(daily_json: str, meta_json: str = "{}", config_json: str = "{}") -> str:
    """Pyodide 진입점: 문자열로 받고 문자열로 돌려준다."""
    return json.dumps(run(json.loads(daily_json), json.loads(meta_json or "{}"), json.loads(config_json or "{}")),
                      ensure_ascii=False)
`,"../../../core/mined_core/validate.py":`"""계열 검증(2-4): 유효 검정 수 M_eff, 상관 군집, 원형 이동 귀무모형.

모두 numpy 만 쓴다(Pyodide 에서도 돈다). 판정 결과(run 의 반환값)를 입력으로 받는다.
"""
from __future__ import annotations

import numpy as np

from .indicators import BY_ID, FAMILIES, INDICATORS


def pr_matrix(result: dict) -> tuple[list[str], np.ndarray]:
    ids = [i.id for i in INDICATORS]
    M = np.array([[np.nan if (w["ind"][i]["pr"] is None) else w["ind"][i]["pr"] for i in ids] for w in result["weeks"]],
                 dtype=float)
    return ids, M


def _rank(x: np.ndarray) -> np.ndarray:
    order = np.argsort(x, kind="mergesort")
    r = np.empty(len(x))
    r[order] = np.arange(len(x), dtype=float)
    # 같은 값은 평균 순위
    xs = x[order]
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[j + 1] == xs[i]:
            j += 1
        if j > i:
            r[order[i:j + 1]] = (i + j) / 2
        i = j + 1
    return r


def spearman_pairwise(M: np.ndarray, min_n: int = 30) -> np.ndarray:
    k = M.shape[1]
    C = np.full((k, k), np.nan)
    for a in range(k):
        C[a, a] = 1.0
        for b in range(a + 1, k):
            m = ~np.isnan(M[:, a]) & ~np.isnan(M[:, b])
            if m.sum() < min_n:
                continue
            ra, rb = _rank(M[m, a]), _rank(M[m, b])
            if np.std(ra) == 0 or np.std(rb) == 0:
                continue
            C[a, b] = C[b, a] = float(np.corrcoef(ra, rb)[0, 1])
    return C


def meff(C: np.ndarray) -> dict:
    """Nyholt(2004) 와 Li & Ji(2005) 의 유효 검정 수. 상관을 모르는 쌍(nan)은 0으로 둔다."""
    k = C.shape[0]
    if k == 0:
        return {"M": 0, "nyholt": 0.0, "li_ji": 0.0}
    A = np.nan_to_num(C, nan=0.0)
    np.fill_diagonal(A, 1.0)
    lam = np.clip(np.linalg.eigvalsh(A), 0, None)
    nyholt = 1 + (k - 1) * (1 - np.var(lam, ddof=1) / k) if k > 1 else 1.0
    li_ji = float(sum((1 if l >= 1 else 0) + (l - np.floor(l)) for l in np.abs(lam)))
    return {"M": k, "nyholt": round(float(nyholt), 3), "li_ji": round(li_ji, 3)}


def clusters(C: np.ndarray, ids: list[str], cut: float = 0.5) -> list[list[str]]:
    """평균 연결 계층 군집. 거리 1-|ρ|, 거리가 cut 이하일 때까지 묶는다(|ρ| ≥ 0.5 끼리)."""
    groups = [[k] for k in range(len(ids))]
    D = 1 - np.abs(np.nan_to_num(C, nan=0.0))

    def dist(g, h):
        return float(np.mean([D[a, b] for a in g for b in h]))

    while len(groups) > 1:
        best = None
        for x in range(len(groups)):
            for y in range(x + 1, len(groups)):
                d = dist(groups[x], groups[y])
                if best is None or d < best[0]:
                    best = (d, x, y)
        if best[0] > cut:
            break
        _, x, y = best
        groups[x] = groups[x] + groups[y]
        groups.pop(y)
    return [sorted(ids[k] for k in g) for g in groups]


def family_flags(result: dict) -> tuple[np.ndarray, np.ndarray]:
    """주 × 계열: 그 계열에 배지가 있는지, 그 계열이 관측됐는지."""
    W = len(result["weeks"])
    F = np.zeros((W, len(FAMILIES)), dtype=bool)
    O = np.zeros((W, len(FAMILIES)), dtype=bool)
    for w, wk in enumerate(result["weeks"]):
        for b in wk["badges"]:
            F[w, FAMILIES.index(b["family"])] = True
        for k, f in enumerate(FAMILIES):
            O[w, k] = wk["coverage"][f] == "observed"
    return F, O


def circular_null(result: dict, n_iter: int = 1000, seed: int = 0, min_families: int = 2) -> dict:
    """'서로 다른 계열 min_families 개 이상이 같은 주에 배지를 받는 주'가 우연히 몇 번 나오는지.

    계열마다 (배지, 관측) 시계열을 통째로 무작위 칸만큼 돌려 계열 안 자기상관은 두고 계열 사이 정렬만 깬다.
    """
    F, O = family_flags(result)
    W, K = F.shape
    obs = int((F.sum(1) >= min_families).sum())
    rng = np.random.default_rng(seed)
    null = np.empty(n_iter)
    for it in range(n_iter):
        G = np.empty_like(F)
        for k in range(K):
            G[:, k] = np.roll(F[:, k], int(rng.integers(0, W)))
        null[it] = (G.sum(1) >= min_families).sum()
    return {
        "observed": obs,
        "null_mean": round(float(null.mean()), 2),
        "null_p95": float(np.percentile(null, 95)),
        "ratio": round(float(obs / null.mean()), 3) if null.mean() > 0 else None,
        "p_value": round(float((null >= obs).mean()), 4),
        "n_iter": n_iter,
    }


def report(result: dict, n_iter: int = 1000) -> dict:
    ids, M = pr_matrix(result)
    C = spearman_pairwise(M)
    fam = {}
    for f in FAMILIES:
        idx = [k for k, i in enumerate(ids) if BY_ID[i].family == f and np.sum(~np.isnan(M[:, k])) >= 30]
        if len(idx) >= 2:
            fam[f] = {"indicators": [ids[k] for k in idx], **meff(C[np.ix_(idx, idx)])}
        elif len(idx) == 1:
            fam[f] = {"indicators": [ids[idx[0]]], "M": 1, "nyholt": 1.0, "li_ji": 1.0}
    live = [k for k in range(len(ids)) if np.sum(~np.isnan(M[:, k])) >= 30]
    return {
        "meff_all": meff(C[np.ix_(live, live)]),
        "meff_by_family": fam,
        "clusters": clusters(C[np.ix_(live, live)], [ids[k] for k in live]),
        "corr": {ids[a]: {ids[b]: (None if np.isnan(C[a, b]) else round(float(C[a, b]), 3)) for b in live} for a in live},
        "cross_null": circular_null(result, n_iter=n_iter),
    }
`,"../../../core/mined_core/weeks.py":`"""일 단위 표를 ISO 주(월요일 시작) 단위로 묶는다."""
from __future__ import annotations

import datetime as dt

from .indicators import DAILY_SUM_FIELDS, DAY_FAMILIES, FIELD_CHANNEL, FAMILIES, HEALTH_DAY_FIELDS


def parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s[:10])


def monday(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


def iso_key(d: dt.date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def channel_ranges(daily: list[dict], meta: dict) -> dict[str, tuple[dt.date, dt.date]]:
    """채널별 활동 범위. 메타에 있으면 메타를, 없으면 기록이 있는 날짜에서 계산한다."""
    seen: dict[str, list[dt.date]] = {}
    for row in daily:
        d = parse_date(row["date"])
        for f, ch in FIELD_CHANNEL.items():
            val = row.get(f)
            if val is None:
                continue
            if ch in DAY_FAMILIES or val > 0:
                seen.setdefault(ch, []).append(d)
    out: dict[str, tuple[dt.date, dt.date]] = {}
    chmeta = (meta or {}).get("channels", {}) or {}
    for ch in FAMILIES:
        m = chmeta.get(ch)
        if m and m.get("first") and m.get("last"):
            out[ch] = (parse_date(m["first"]), parse_date(m["last"]))
        elif ch in seen:
            out[ch] = (min(seen[ch]), max(seen[ch]))
    return out


def build_weeks(daily: list[dict], meta: dict) -> tuple[list[dt.date], list[dict], dict]:
    """주 목록(월요일 날짜), 주별 합계 dict, 채널 범위를 돌려준다.

    주별 dict 에는 DAILY_SUM_FIELDS 의 합과 steps_days·sleep_days(키가 있던 날 수),
    채널별 in_range_days(그 주에 채널 활동 범위에 들어간 날 수)가 들어간다.
    """
    ranges = channel_ranges(daily, meta)
    if not ranges:
        return [], [], ranges
    start = monday(min(r[0] for r in ranges.values()))
    end = monday(max(r[1] for r in ranges.values()))
    n = (end - start).days // 7 + 1
    mondays = [start + dt.timedelta(days=7 * i) for i in range(n)]
    weeks = [dict() for _ in range(n)]
    for row in daily:
        d = parse_date(row["date"])
        i = (d - start).days // 7
        if i < 0 or i >= n:
            continue
        w = weeks[i]
        for f in DAILY_SUM_FIELDS:
            v = row.get(f)
            if v is None:
                continue
            w[f] = w.get(f, 0) + v
        for f, days in HEALTH_DAY_FIELDS.items():
            if row.get(f) is not None:
                w[days] = w.get(days, 0) + 1
    for i, m in enumerate(mondays):
        for ch, (a, b) in ranges.items():
            lo = max(a, m)
            hi = min(b, m + dt.timedelta(days=6))
            weeks[i][f"{ch}_in_range_days"] = max(0, (hi - lo).days + 1)
    return mondays, weeks, ranges
`})).map(([e,t])=>[e.split(`/`).pop(),t]));async function Qe(e,t){e.FS.mkdirTree(`/home/pyodide/mined_core`);for(let[n,r]of Object.entries(t))e.FS.writeFile(`/home/pyodide/mined_core/${n}`,r);e.runPython(`import sys
if "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")`)}function $e(e,t,n,r=`{}`){return e.globals.set(`_d`,t),e.globals.set(`_m`,n),e.globals.set(`_c`,r),e.runPython(`import mined_core
mined_core.run_json(_d, _m, _c)`)}function et(e,t,n,r,i=`{}`,a){e.globals.set(`_d`,t),e.globals.set(`_m`,n),e.globals.set(`_e`,r),e.globals.set(`_o`,i),e.globals.set(`_p`,a??null);try{return e.runPython(`from mined_core.field_eval import field_report_json
field_report_json(_d, _m, _e, _o, _p)`)}finally{e.globals.delete(`_p`)}}let tt=null;function $(e){return tt||=(async()=>{e?.(`Python 런타임 불러오는 중`);let t=new URL(`../`+`./`.replace(/^\.\//,``)+`pyodide/`,self.location.href).href,n=await Xe({indexURL:t});return e?.(`numpy 불러오는 중`),await n.loadPackage(`numpy`),await Qe(n,Ze),n})(),tt}h({async warmup(e){let t=performance.now();return await $(e),Math.round(performance.now()-t)},async judge(e,t,n=`{}`,r){let i=await $(r);r?.(`판정 중`);let a=performance.now();return{json:$e(i,e,t,n),ms:Math.round(performance.now()-a)}},async fieldReport(e,t,n,r=`{}`,i){let a=await $(i),o=performance.now();return{json:et(a,e,t,n,r,e=>{i?.(e)}),ms:Math.round(performance.now()-o)}}});export{o as t};