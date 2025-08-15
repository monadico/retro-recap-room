// Environment configuration for local development vs production
console.log('[ENV DEBUG] VITE_API_BASE:', (import.meta as any).env?.VITE_API_BASE);
console.log('[ENV DEBUG] All env vars:', (import.meta as any).env);

export const config = {
  // API base URL - use environment variable or fallback to backend
  apiBase: (import.meta as any).env?.VITE_API_BASE || 'https://j4s0800ggs8oow8g4g0ooww4.173.249.24.245.sslip.io',
  
  // WebSocket configuration
  ws: {
    // Protocol: ws for local, wss for production
    protocol: (import.meta as any).env?.VITE_API_BASE ? 'wss' : 'wss',
    // Host: extract from VITE_API_BASE or default to backend
    host: (() => {
      const apiBase = (import.meta as any).env?.VITE_API_BASE;
      if (apiBase) {
        // Extract host from https://domain.com -> domain.com
        return apiBase.replace(/^https?:\/\//, '');
      }
      return 'j4s0800ggs8oow8g4g0ooww4.173.249.24.245.sslip.io';
    })(),
    // Full WebSocket URL
    get url() {
      return `${this.protocol}://${this.host}`;
    }
  },
  
  // Check if we're in production (has VITE_API_BASE set)
  isProduction: !!(import.meta as any).env?.VITE_API_BASE,
  
  // Check if we're in local development
  isLocal: !(import.meta as any).env?.VITE_API_BASE
};
