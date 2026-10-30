import axios from 'axios';

export function createRazorpayProvider(config) {
  const client = axios.create({
    baseURL: 'https://api.razorpay.com/v1', timeout: 15000, maxRedirects: 0,
    auth: { username: config.razorpayKeyId, password: config.razorpayKeySecret },
    headers: { 'Content-Type': 'application/json' },
  });
  return {
    async createOrder(order) { return (await client.post('/orders', order)).data; },
    async getPayment(id) { return (await client.get(`/payments/${encodeURIComponent(id)}`)).data; },
  };
}
