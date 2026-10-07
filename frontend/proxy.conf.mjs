export default {
  '/api': { target: process.env.API_GATEWAY_URL ?? 'http://localhost:3000' },
};
