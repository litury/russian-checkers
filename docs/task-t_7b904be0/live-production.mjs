import {build,preview} from 'vite';
process.env.VITE_API_URL='http://127.0.0.1:18961';
await build();
const s=await preview({preview:{host:'127.0.0.1',port:4292,strictPort:true}});s.printUrls();
