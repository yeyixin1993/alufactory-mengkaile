// API Service for Frontend Integration
// Place this in your services folder and update your imports

import { API_BASE_URL } from '@/config'; // Set to http://localhost:5000/api

export class ApiService {
  static authToken: string | null = localStorage.getItem('authToken');

  private static async request(
    method: string,
    endpoint: string,
    data?: any
  ) {
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
        // Token expired, clear and redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // AUTH ENDPOINTS
  static async register(username: string, phone: string, password: string) {
    const data = await this.request('POST', '/auth/register', {
      username,
      phone,
      password,
    });
    if (data.access_token) {
      this.authToken = data.access_token;
      localStorage.setItem('authToken', data.access_token);
    }
    return data.user;
  }

  static async login(phone: string, password: string) {
    const data = await this.request('POST', '/auth/login', {
      phone,
      password,
    });
    if (data.access_token) {
      this.authToken = data.access_token;
      localStorage.setItem('authToken', data.access_token);
    }
    return data.user;
  }

  static async getCurrentUser() {
    return this.request('GET', '/auth/me');
  }

  static async changePassword(oldPassword: string, newPassword: string) {
    return this.request('POST', '/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  static async logout() {
    this.authToken = null;
    localStorage.removeItem('authToken');
    await this.request('POST', '/auth/logout');
  }

  // USER ENDPOINTS
  static async getUser(userId: string) {
    return this.request('GET', `/users/${userId}`);
  }

  static async updateUser(userId: string, data: any) {
    return this.request('PUT', `/users/${userId}`, data);
  }

  static async getUserAddresses(userId: string) {
    return this.request('GET', `/users/${userId}/addresses`);
  }

  static async addAddress(userId: string, address: any) {
    return this.request('POST', `/users/${userId}/addresses`, address);
  }

  static async updateAddress(addressId: string, address: any) {
    return this.request('PUT', `/users/addresses/${addressId}`, address);
  }

  static async deleteAddress(addressId: string) {
    return this.request('DELETE', `/users/addresses/${addressId}`);
  }

  // CART ENDPOINTS
  static async getCart() {
    return this.request('GET', '/cart');
  }

  static async addToCart(item: any) {
    return this.request('POST', '/cart/items', item);
  }

  static async updateCartItem(itemId: string, data: any) {
    return this.request('PUT', `/cart/items/${itemId}`, data);
  }

  static async removeFromCart(itemId: string) {
    return this.request('DELETE', `/cart/items/${itemId}`);
  }

  static async clearCart() {
    return this.request('POST', '/cart/clear');
  }

  // ORDER ENDPOINTS
  static async getOrders() {
    return this.request('GET', '/orders');
  }

  static async getOrder(orderId: string) {
    return this.request('GET', `/orders/${orderId}`);
  }

  static async createOrder(order: any) {
    return this.request('POST', '/orders', order);
  }

  static async updateOrder(orderId: string, data: any) {
    return this.request('PUT', `/orders/${orderId}`, data);
  }

  static async deleteOrder(orderId: string) {
    return this.request('DELETE', `/orders/${orderId}`);
  }

  // ADMIN ENDPOINTS
  static async getAdminUsers(page = 1, perPage = 50) {
    return this.request('GET', `/admin/users?page=${page}&per_page=${perPage}`);
  }

  static async activateUser(userId: string) {
    return this.request('POST', `/admin/users/${userId}/activate`);
  }

  static async deactivateUser(userId: string) {
    return this.request('POST', `/admin/users/${userId}/deactivate`);
  }

  static async promoteUser(userId: string) {
    return this.request('POST', `/admin/users/${userId}/promote`);
  }

  static async updateMembership(userId: string, level: string) {
    return this.request('PUT', `/admin/users/${userId}/membership`, {
      membership_level: level,
    });
  }

  static async getAdminOrders(page = 1, perPage = 50, status?: string) {
    let url = `/admin/orders?page=${page}&per_page=${perPage}`;
    if (status) url += `&status=${status}`;
    return this.request('GET', url);
  }

  static async updateOrderStatus(orderId: string, status: string) {
    return this.request('PUT', `/admin/orders/${orderId}/status`, { status });
  }

  static async getStatistics() {
    return this.request('GET', '/admin/statistics');
  }

  static isAuthenticated(): boolean {
    return !!this.authToken;
  }

  static getToken(): string | null {
    return this.authToken;
  }
}

export default ApiService;
