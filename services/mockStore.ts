
import { Order, Product, User, Address, ProfileVariant, ColorDef } from '../types';
import { INITIAL_PRODUCTS, PROFILE_VARIANTS, PROFILE_COLORS, SHIPPING_RATES } from '../constants';

const DB_KEYS = {
  USERS: 'mengkaile_users',
  ORDERS: 'mengkaile_orders',
  CURRENT_USER: 'mengkaile_session',
  VARIANTS: 'mengkaile_variants',
  COLORS: 'mengkaile_colors'
};

const getStored = <T>(key: string, fallback: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error parsing localStorage key: ${key}`, e);
    return fallback;
  }
};

const setStored = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initial admin setup
const initialUsers: User[] = [
  { id: 'admin', name: 'System Admin', password: 'admin', role: 'admin', addresses: [] }
];

export const MockService = {
  // Auth
  register: (user: User) => {
    const users = getStored<User[]>(DB_KEYS.USERS, initialUsers);
    if (users.find(u => u.id === user.id)) return Promise.reject("Phone number already registered");
    users.push(user);
    setStored(DB_KEYS.USERS, users);
    return Promise.resolve(user);
  },

  login: (id: string, pass: string) => {
    const users = getStored<User[]>(DB_KEYS.USERS, initialUsers);
    const user = users.find(u => u.id === id && u.password === pass);
    if (!user) return Promise.reject("Invalid credentials");
    // Explicitly set the session ID in localStorage
    localStorage.setItem(DB_KEYS.CURRENT_USER, user.id);
    return Promise.resolve(JSON.parse(JSON.stringify(user)));
  },

  logout: () => {
    localStorage.removeItem(DB_KEYS.CURRENT_USER);
    return Promise.resolve();
  },

  getCurrentUser: () => {
    const userId = localStorage.getItem(DB_KEYS.CURRENT_USER);
    if (!userId) return Promise.resolve(null);
    
    const users = getStored<User[]>(DB_KEYS.USERS, initialUsers);
    const user = users.find(u => u.id === userId);
    return Promise.resolve(user ? JSON.parse(JSON.stringify(user)) : null);
  },

  updateUser: (updated: User) => {
    const users = getStored<User[]>(DB_KEYS.USERS, initialUsers);
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx > -1) {
      users[idx] = JSON.parse(JSON.stringify(updated));
      setStored(DB_KEYS.USERS, users);
      return Promise.resolve(JSON.parse(JSON.stringify(updated)));
    }
    return Promise.reject("User not found in database during update");
  },

  updateUserAddresses: (addresses: Address[]) => {
    return MockService.getCurrentUser().then(user => {
      if (!user) return Promise.reject("Not logged in - Session not found");
      user.addresses = addresses;
      return MockService.updateUser(user);
    });
  },

  changePassword: (newPass: string) => {
    return MockService.getCurrentUser().then(user => {
      if (!user) return Promise.reject("Not logged in");
      user.password = newPass;
      return MockService.updateUser(user);
    });
  },

  // Products & Configs
  getProducts: () => Promise.resolve([...INITIAL_PRODUCTS]),
  getVariants: () => Promise.resolve(getStored<ProfileVariant[]>(DB_KEYS.VARIANTS, PROFILE_VARIANTS)),
  getColors: () => Promise.resolve(getStored<ColorDef[]>(DB_KEYS.COLORS, PROFILE_COLORS)),

  // Orders
  createOrder: (order: Order) => {
    const orders = getStored<Order[]>(DB_KEYS.ORDERS, []);
    orders.push(order);
    setStored(DB_KEYS.ORDERS, orders);
    return Promise.resolve(order);
  },

  deleteOrder: (id: string) => {
    const orders = getStored<Order[]>(DB_KEYS.ORDERS, []);
    const filtered = orders.filter(o => o.id !== id);
    setStored(DB_KEYS.ORDERS, filtered);
    return Promise.resolve();
  },

  getOrders: (userId: string) => {
    const orders = getStored<Order[]>(DB_KEYS.ORDERS, []);
    const users = getStored<User[]>(DB_KEYS.USERS, initialUsers);
    const me = users.find(u => u.id === userId);
    if (me?.role === 'admin') return Promise.resolve(orders);
    return Promise.resolve(orders.filter(o => o.userId === userId));
  },

  getPoolState: () => {
    return [
      { id: 'occupied1', width: 500, height: 1000, x: 5, y: 5, color: '#9ca3af' },
      { id: 'occupied2', width: 800, height: 600, x: 520, y: 5, color: '#9ca3af' },
    ];
  }
};
