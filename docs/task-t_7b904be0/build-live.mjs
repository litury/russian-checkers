import {build} from 'vite';
process.env.VITE_API_URL='http://127.0.0.1:18961';
await build();
