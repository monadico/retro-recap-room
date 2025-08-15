// Environment configuration for local development vs production
export const config = {
  // API base URL - defaults to localhost for development
  apiBase: (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001',
  
  // WebSocket configuration
  ws: {
    // Protocol: ws for local, wss for production
    protocol: (import.meta as any).env?.VITE_API_BASE ? 'wss' : 'ws',
    // Host: extract from VITE_API_BASE or default to localhost
    host: (() => {
      const apiBase = (import.meta as any).env?.VITE_API_BASE;
      if (apiBase) {
        // Extract host from https://domain.com -> domain.com
        return apiBase.replace(/^https?:\/\//, '');
      }
      return 'localhost:3001';
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
