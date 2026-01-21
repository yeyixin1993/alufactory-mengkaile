// Real API Service connecting to Flask backend
import { Order, User, Address } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    return {
      id: data.user.id,
      name: data.user.username,
      password: '',
      role: 'customer' as const,
      addresses: data.user.addresses || [],
    };
  }

  async getCurrentUser() {
    if (!this.authToken) return null;
    try {
      const data = await this.request('GET', '/auth/me');
      return {
        id: data.id,
        name: data.username,
        password: '',
        role: 'customer' as const,
        addresses: data.addresses || [],
      };
    } catch (e) {
      return null;
    }
  }

  async logout() {
    this.authToken = null;
    localStorage.removeItem('authToken');
    await this.request('POST', '/auth/logout');
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
        // New address
        await this.request('POST', `/users/${user.id}/addresses`, {
          name: addr.name,
          phone: addr.phone,
          province: addr.province,
          detail: addr.detail,
          is_default: addr.isDefault,
        });
      } else {
        // Update existing
        await this.request('PUT', `/users/addresses/${addr.id}`, {
          name: addr.name,
          phone: addr.phone,
          province: addr.province,
          detail: addr.detail,
          is_default: addr.isDefault,
        });
      }
    }

    return user;
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
    const data = await this.request('POST', '/orders', {
      items: order.items,
      shipping_fee: order.shippingFee,
      total: order.total,
      address_id: order.address?.id,
    });
    return {
      id: data.id,
      date: new Date().toISOString(),
      items: order.items,
      total: data.total,
      shippingFee: data.shipping_fee,
      status: 'pending' as const,
      userId: data.user_id,
      address: order.address,
    };
  }

  async getOrders(userId: string) {
    const data = await this.request('GET', '/orders');
    return data.map((order: any) => ({
      id: order.id,
      date: order.created_at,
      items: order.items || [],
      total: order.total,
      shippingFee: order.shipping_fee,
      status: order.status,
      userId: order.user_id,
      address: order.address,
    }));
  }

  async deleteOrder(id: string) {
    await this.request('DELETE', `/orders/${id}`);
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  getToken(): string | null {
    return this.authToken;
  }
}

export const ApiService = new ApiServiceClass();
