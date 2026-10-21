import base from './vite.config.js'
export default { ...base, server: { ...base.server, proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } } }
