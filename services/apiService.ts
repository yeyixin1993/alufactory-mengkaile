// Real API Service connecting to Flask backend
import { Order, User, Address } from '../types';

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

const resolveApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  if (typeof window !== 'undefined') {
    const runtimeUrl = (window as any).__API_BASE_URL__;
    if (typeof runtimeUrl === 'string' && runtimeUrl.trim()) {
      return normalizeBaseUrl(runtimeUrl.trim());
    }

    if (window.location?.origin) {
      return `${normalizeBaseUrl(window.location.origin)}/api`;
    }
  }

  return 'http://localhost:5000/api';
};

const API_BASE_URL = resolveApiBaseUrl();

class ApiServiceClass {
  private authToken: string | null = localStorage.getItem('authToken');

  private async request(method: string, endpoint: string, data?: any) {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.authToken) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${this.authToken}`,
      };
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        localStorage.removeItem('authToken');
        this.authToken = null;
        window.location.href = '/#/login';
      }
      const error = await response.json();
      throw new Error(error.error || error.message || 'API request failed');
    }

    return response.json();
  }

  // ===== AUTH =====
  async register(phone: string, password: string, username: string) {
    const data = await this.request('POST', '/auth/register', {
      phone,
      password,
      username,
    });
    if (data.access_token) {
      this.authToken = data.access_token;
      localStorage.setItem('authToken', data.access_token);
    }
    return {
      id: data.user.id,
      name: data.user.username,
      password: '',
      role: 'customer' as const,
      addresses: [],
    };
  }

  async login(phone: string, password: string) {
    const data = await this.request('POST', '/auth/login', {
      phone,
      password,
    });
    if (data.access_token) {
      this.authToken = data.access_token;
      localStorage.setItem('authToken', data.access_token);
    }
    
    // Fetch complete user data including addresses
    const user = await this.getCurrentUser();
    return user || {
      id: data.user.id,
      name: data.user.username,
      password: '',
      role: 'customer' as const,
      addresses: data.user.addresses || [],
    };
  }

  async getCurrentUser() {
    // Always read fresh from localStorage in case token was just set
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('No auth token found in localStorage');
      return null;
    }
    
    try {
      const data = await this.request('GET', '/auth/me');
      const user = data.user || data;
      return {
        id: user.id,
        name: user.username,
        password: '',
        role: 'customer' as const,
        addresses: data.addresses || user.addresses || [],
      };
    } catch (e) {
      console.error('getCurrentUser error:', e);
      return null;
    }
  }

  async logout() {
    this.authToken = null;
    localStorage.removeItem('authToken');
    try {
      await this.request('POST', '/auth/logout');
    } catch (e) {
      // Logout endpoint may return 401 if token expired, but we're clearing local state anyway
      console.log('Logout completed locally');
    }
  }

  async changePassword(oldPassword: string, newPassword: string) {
    await this.request('POST', '/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // ===== USER =====
  async updateUser(user: User) {
    const data = await this.request('PUT', `/users/${user.id}`, {
      username: user.name,
    });
    return {
      id: data.id,
      name: data.username,
      password: '',
      role: 'customer' as const,
      addresses: data.addresses || [],
    };
  }

  async updateUserAddresses(addresses: Address[]) {
    // Get current user first
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // Update addresses one by one
    for (const addr of addresses) {
      if (addr.id?.startsWith('temp_')) {
        // New address - POST and get response
        await this.request('POST', `/users/${user.id}/addresses`, {
          recipient_name: addr.recipient_name,
          phone: addr.phone,
          province: addr.province,
          detail: addr.detail,
          is_default: addr.isDefault,
        });
      } else if (addr.id) {
        // Update existing
        await this.request('PUT', `/users/addresses/${addr.id}`, {
          recipient_name: addr.recipient_name,
          phone: addr.phone,
          province: addr.province,
          detail: addr.detail,
          is_default: addr.isDefault,
        });
      }
    }

    // Fetch fresh user data to get all updated addresses with real IDs from backend
    return await this.getCurrentUser();
  }

  // ===== PRODUCTS (fallback to mock) =====
  async getProducts() {
    // Products are read-only, use local data
    return Promise.resolve([]);
  }

  async getVariants() {
    return Promise.resolve([]);
  }

  async getColors() {
    return Promise.resolve([]);
  }

  // ===== CART =====
  async getCart() {
    try {
      const data = await this.request('GET', '/cart');
      return {
        items: data.items?.map((item: any) => ({
          id: item.id,
          product: { id: item.product_id, type: '', name: {}, description: {}, basePrice: 0, imageUrl: '' },
          quantity: item.quantity,
          config: item.config || {},
          totalPrice: item.total_price,
        })) || [],
      };
    } catch (e) {
      return { items: [] };
    }
  }

  async addToCart(product: any, quantity: number, config: any) {
    const data = await this.request('POST', '/cart/items', {
      product_id: product.id,
      quantity,
      config,
    });
    return {
      id: data.id,
      product,
      quantity: data.quantity,
      config: data.config || {},
      totalPrice: data.total_price,
    };
  }

  async updateCartItem(itemId: string, quantity: number) {
    await this.request('PUT', `/cart/items/${itemId}`, { quantity });
  }

  async removeFromCart(itemId: string) {
    await this.request('DELETE', `/cart/items/${itemId}`);
  }

  async clearCart() {
    await this.request('POST', '/cart/clear');
  }

  // ===== ORDERS =====
  async createOrder(order: Order) {
    // Validate address exists and has all required fields
    if (!order.address) {
      throw new Error('Shipping address is required');
    }

    if (!order.address.recipient_name || !order.address.phone || !order.address.province || !order.address.detail) {
      console.error('Invalid address fields:', order.address);
      throw new Error('Shipping address must have name, phone, province, and detail');
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    if (!order.total || order.total <= 0) {
      throw new Error('Order total must be greater than 0');
    }

    // Format items to match backend expectations
    const formattedItems = order.items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name.en,
      product_type: item.product.type,
      quantity: item.quantity,
      unit_price: item.totalPrice / item.quantity,
      total_price: item.totalPrice,
      config: item.config
    }));

    const payload = {
      items: formattedItems,
      recipient_name: order.address.recipient_name,
      phone: order.address.phone,
      province: order.address.province,
      address_detail: order.address.detail,
      subtotal: order.total - order.shippingFee,
      shipping_fee: order.shippingFee,
      total_amount: order.total,
    };

    // Debug logging
    console.log('Creating order with payload:', JSON.stringify(payload, null, 2));

    const data = await this.request('POST', '/orders', payload);
    return {
      id: data.order.id,
      date: new Date().toISOString(),
      items: order.items,
      total: data.order.total_amount,
      shippingFee: data.order.shipping_fee,
      status: 'pending' as const,
      userId: data.order.user_id,
      address: order.address,
    };
  }

  async getOrders(userId: string) {
    const data = await this.request('GET', '/orders');
    const orders = data.orders || data;
    return Array.isArray(orders) ? orders.map((order: any) => ({
      id: order.id,
      date: order.created_at,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        product: {
          id: item.product_id,
          type: item.product_type,
          name: { en: item.product_name || item.product_id, cn: item.product_name || item.product_id, jp: item.product_name || item.product_id },
          description: { en: '', cn: '', jp: '' },
          basePrice: item.unit_price || 0,
          imageUrl: ''
        },
        quantity: item.quantity,
        config: item.config || {},
        totalPrice: item.total_price || 0
      })),
      total: order.total_amount ?? order.total ?? 0,
      shippingFee: order.shipping_fee ?? 0,
      status: order.status,
      userId: order.user_id,
      address: order.address || {
        id: '',
        recipient_name: order.recipient_name,
        phone: order.phone,
        province: order.province,
        detail: order.address_detail
      },
    })) : [];
  }

  async deleteOrder(id: string) {
    await this.request('DELETE', `/orders/${id}`);
  }

  async uploadOrderPdf(orderId: string, pdfBase64: string, pdfFilename: string) {
    await this.request('POST', `/orders/${orderId}/pdf`, {
      pdf_base64: pdfBase64,
      pdf_filename: pdfFilename,
    });
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  getToken(): string | null {
    return this.authToken;
  }
}

export const ApiService = new ApiServiceClass();
