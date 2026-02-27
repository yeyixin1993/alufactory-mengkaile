
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart, User as UserIcon, LogOut, Menu, X, Globe, Home, Package, History, Settings, FileDown, Eye, Truck, MapPin, Plus, Trash2, Edit2, CheckCircle, ArrowLeft, Lock, Save, UserCheck, Key, Info, Pencil, ChevronRight, Download } from 'lucide-react';
import { Language, User, CartItem, Product, ProductType, ProfileConfig, PlateConfig, Order, ProfileSide, DrillHole, Address, ProfileVariant, ColorDef } from './types';
import { TRANSLATIONS, INITIAL_PRODUCTS, PROFILE_COLORS, PROFILE_VARIANTS, PROFILE_WEIGHTS, SHIPPING_RATES } from './constants';
import { ApiService } from './services/apiService';
import ProfileEditor from './components/ProfileEditor';
import SharedBoardEditor from './components/SharedBoardEditor';
import FrameEditor from './components/FrameEditor';
import ShufateCabinetEditor from './components/ShufateCabinetEditor';
import ProfileVisualizer from './components/ProfileVisualizer';
import FactorySheetPreview from './components/FactorySheetPreview';
import FactorySheet from './components/FactorySheet';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const getCurrency = (lang: Language) => lang === 'cn' ? '￥' : '$';

const mergeCartItems = (currentCart: CartItem[], newItems: CartItem[]): CartItem[] => {
  const nextCart = [...currentCart];
  newItems.forEach(newItem => {
    const existingIndex = nextCart.findIndex(item => 
      item.product.id === newItem.product.id && 
      JSON.stringify(item.config) === JSON.stringify(newItem.config)
    );

    if (existingIndex !== -1) {
      const existingItem = nextCart[existingIndex];
      const newQty = existingItem.quantity + newItem.quantity;
      const unitPrice = existingItem.totalPrice / existingItem.quantity;
      nextCart[existingIndex] = {
        ...existingItem,
        quantity: newQty,
        totalPrice: Number((unitPrice * newQty).toFixed(1))
      };
    } else {
      nextCart.push({ ...newItem });
    }
  });
  return nextCart;
};

const LanguageSwitcher: React.FC<{ current: Language, onChange: (l: Language) => void }> = ({ current, onChange }) => (
  <div className="flex bg-slate-100 p-1 rounded-xl">
    {(['en', 'cn', 'jp'] as Language[]).map(lang => (
      <button key={lang} onClick={() => onChange(lang)} className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${current === lang ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
        {lang.toUpperCase()}
      </button>
    ))}
  </div>
);

// --- Robust Smart PDF Helper with Page Split Prevention ---
const exportToPDF = async (
  element: HTMLElement | null,
  filename: string,
  options?: { returnBase64?: boolean; skipSave?: boolean }
) => {
  if (!element) return;
  
  // 1122px is roughly the height of an A4 page at 96 DPI
  const A4_PX_HEIGHT = 1115; 
  const items = element.querySelectorAll('.break-inside-avoid');

  // Clear any existing margins we added previously
  (Array.from(element.children) as HTMLElement[]).forEach(child => child.style.marginTop = '0px');

  // We iterate through items and check if their bottom crosses the next page threshold.
  // If it does, we push the item to the start of the next page by adding margin.
  let cumulativePush = 0;
  
  // We need to work on a cloned or live element carefully.
  // Here we iterate over the actual children of the container.
  const children = Array.from(element.children) as HTMLElement[];
  
  children.forEach((child) => {
    const rect = child.getBoundingClientRect();
    const parentRect = element.getBoundingClientRect();
    
    // Position relative to parent start including previous pushes
    const relativeTop = rect.top - parentRect.top;
    const relativeBottom = relativeTop + rect.height;
    
    // Current page number of the top of the item
    const pageNum = Math.floor(relativeTop / A4_PX_HEIGHT);
    const threshold = (pageNum + 1) * A4_PX_HEIGHT;
    
    if (relativeBottom > threshold) {
       // This item crosses a boundary. Move it to the start of the next page.
       const pushAmount = threshold - relativeTop;
       child.style.marginTop = `${pushAmount}px`;
    }
  });

  try {
    const canvas = await html2canvas(element, { 
      scale: 2, 
      useCORS: true, 
      logging: false, 
      backgroundColor: '#ffffff'
    });

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgScale = pdfWidth / imgWidth;
    const imgInPdfHeight = imgHeight * imgScale;
    
    let heightLeft = imgInPdfHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(canvas, 'JPEG', 0, position, pdfWidth, imgInPdfHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;
    
    // Split into multiple pages by shifting the offset
    while (heightLeft > 0) {
      position = heightLeft - imgInPdfHeight; 
      pdf.addPage();
      pdf.addImage(canvas, 'JPEG', 0, position, pdfWidth, imgInPdfHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }
    
    if (!options?.skipSave) {
      pdf.save(filename);
    }

    if (options?.returnBase64) {
      const dataUri = pdf.output('datauristring');
      return dataUri.split(',')[1];
    }
  } catch (e) {
    console.error("PDF Export failed", e);
  } finally {
    // Reset styles after export
    children.forEach(child => child.style.marginTop = '0px');
  }
};


// --- Auth Component ---
const Auth: React.FC<{ language: Language, onLogin: (user: User) => void }> = ({ language, onLogin }) => {
  const t = TRANSLATIONS[language];
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await ApiService.register(phone, password, name);
      }
      const user = await ApiService.login(phone, password);
      onLogin(user);
      
      const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  return (
    <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
      <h2 className="text-3xl font-black text-slate-900 mb-6 text-center">{isRegister ? t.register : t.login}</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 font-bold border border-red-100">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.phone}</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        {isRegister && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.customer}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">
          {isRegister ? t.register : t.login}
        </button>
      </form>
      <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-sm text-blue-600 font-bold hover:underline">
        {isRegister ? t.alreadyRegistered : t.newCustomer}
      </button>
    </div>
  );
};

// --- Profile & History Page ---
const UserProfile: React.FC<{ 
  user: User, 
  language: Language, 
  setUser: (u: User) => void, 
  onEditOrder: (o: Order) => void 
}> = ({ user, language, setUser, onEditOrder }) => {
  const t = TRANSLATIONS[language];
  const [orders, setOrders] = useState<Order[]>([]);
  const [isEditingAddress, setIsEditingAddress] = useState<Address | null | 'new'>(null);
  const [newPass, setNewPass] = useState('');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const adminPrintRef = useRef<HTMLDivElement>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printWithPrice, setPrintWithPrice] = useState(true);

  useEffect(() => {
    ApiService.getOrders(user.id).then(setOrders);
  }, [user.id]);

  const saveAddress = (addr: Address) => {
    if (!addr.recipient_name || !addr.phone || !addr.province || !addr.detail) {
      alert("Please fill all fields");
      return;
    }
    const nextAddrs = isEditingAddress === 'new' ? [...user.addresses, addr] : user.addresses.map(a => a.id === addr.id ? addr : a);
    if (nextAddrs.length > 10) return alert("Maximum 10 addresses allowed");
    
    ApiService.updateUserAddresses(nextAddrs)
      .then(u => {
        setUser(u!);
        setIsEditingAddress(null);
      })
      .catch(err => {
        console.error("Failed to update address", err);
        alert("Failed to save address. Please ensure you are logged in.");
      });
  };

  const deleteOrder = (orderId: string) => {
    if (window.confirm("Delete this order record?")) {
      ApiService.deleteOrder(orderId).then(() => setOrders(orders.filter(o => o.id !== orderId)));
    }
  };

  const updatePass = () => {
    if (!newPass) return;
    ApiService.changePassword('', newPass).then(() => { alert("Password changed!"); setNewPass(''); });
  };

  const getOrderTotal = (order: Order) => {
    if (typeof order.total === 'number' && Number.isFinite(order.total)) {
      return order.total;
    }
    if (Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => {
        const itemTotal = typeof item.totalPrice === 'number' && Number.isFinite(item.totalPrice) ? item.totalPrice : 0;
        return sum + itemTotal;
      }, 0);
    }
    return 0;
  };

  const downloadOrderPDF = async (o: Order, withPrice: boolean) => {
    setIsGenerating(o.id + (withPrice ? '_p' : '_np'));
    setPrintOrder(o);
    setPrintWithPrice(withPrice);
    await new Promise(r => setTimeout(r, 600));
    await exportToPDF(adminPrintRef.current, `Mengkaile_Order_${o.id}_${withPrice ? 'Price' : 'NoPrice'}.pdf`);
    setIsGenerating(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-12">
      <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <div ref={adminPrintRef} className="w-[210mm]">
          {printOrder && (
            <FactorySheet 
              cart={printOrder.items} 
              user={user} 
              language={language} 
              orderRef={printOrder.id} 
              dateStr={new Date(printOrder.date).toLocaleDateString()} 
              showPrice={printWithPrice}
              address={printOrder.address}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-4xl font-black text-slate-900">{user.name}'s Dashboard</h2>
        <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl w-full sm:w-auto">
           <input type="password" placeholder={t.newPassword} value={newPass} onChange={e => setNewPass(e.target.value)} className="bg-transparent border-none outline-none px-3 text-sm flex-1 sm:w-32 text-slate-700" />
           <button onClick={updatePass} className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-xs font-black shadow-sm">{t.update}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600"/> {t.shippingAddress}</h3>
                <button onClick={() => setIsEditingAddress('new')} className="text-blue-600 hover:underline text-xs font-bold">{t.addNew}</button>
              </div>
              <div className="space-y-4">
                 {user.addresses.map(a => (
                   <div key={a.id} className="p-5 border rounded-3xl bg-slate-50 relative group border-slate-200">
                      <div className="font-bold text-slate-800">{a.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{a.phone}</div>
                      <div className="text-xs text-slate-500">{a.province} {a.detail}</div>
                      <div className="flex gap-4 mt-3">
                        <button onClick={() => setIsEditingAddress(a)} className="text-blue-600 text-[10px] font-black uppercase tracking-wider">{t.edit}</button>
                        <button onClick={() => ApiService.updateUserAddresses(user.addresses.filter(x => x.id !== a.id)).then(u => setUser(u!))} className="text-red-500 text-[10px] font-black uppercase tracking-wider">{t.remove}</button>
                      </div>
                   </div>
                 ))}
                 {user.addresses.length === 0 && <p className="text-slate-400 text-sm italic py-4">{t.noAddress}</p>}
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><History className="w-5 h-5 text-blue-600"/> {t.orderHistory}</h3>
              <div className="space-y-4">
                 {orders.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(o => (
                   <div key={o.id} className="p-6 border rounded-3xl hover:border-blue-200 transition-colors border-slate-100 bg-white">
                      <div className="flex flex-col justify-between gap-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                          <div>
                            <div className="text-xs text-slate-400 mb-1">{new Date(o.date).toLocaleString()}</div>
                            <div className="font-black text-slate-800">Order #{o.id}</div>
                            <div className="text-lg font-black text-blue-600 mt-1">{getCurrency(language)}{getOrderTotal(o).toFixed(1)}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
                             {user.role === 'admin' && (
                               <>
                                 <button disabled={!!isGenerating} onClick={() => downloadOrderPDF(o, true)} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-xs font-black hover:bg-blue-100 transition-all border border-blue-100">
                                   <FileDown className="w-3 h-3"/> {isGenerating === o.id + '_p' ? '...' : t.downloadPdf}
                                 </button>
                                 <button disabled={!!isGenerating} onClick={() => downloadOrderPDF(o, false)} className="flex items-center gap-2 bg-orange-50 text-orange-600 px-3 py-2 rounded-xl text-xs font-black hover:bg-orange-100 transition-all border border-orange-100">
                                   <FileDown className="w-3 h-3"/> {isGenerating === o.id + '_np' ? '...' : t.downloadNoPrice}
                                 </button>
                               </>
                             )}
                             <button onClick={() => onEditOrder(o)} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-200"><Edit2 className="w-4 h-4"/></button>
                             <button onClick={() => deleteOrder(o.id)} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors border border-red-100"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.shippingAddress}</h4>
                           <div className="text-xs font-bold text-slate-700">
                             {o.address ? (
                               <>
                                 <div className="mb-1">{o.address.recipient_name} · {o.address.phone}</div>
                                 <div className="text-slate-500">{o.address.province} {o.address.detail}</div>
                               </>
                             ) : (
                               <div className="text-slate-400 italic">No address provided</div>
                             )}
                           </div>
                        </div>
                      </div>
                   </div>
                 ))}
                 {orders.length === 0 && <p className="text-center py-20 text-slate-300 italic font-black">{t.noTransaction}</p>}
              </div>
           </div>
        </div>
      </div>

      {isEditingAddress && (
        <AddressModal 
          language={language} 
          address={isEditingAddress === 'new' ? undefined : isEditingAddress} 
          onClose={() => setIsEditingAddress(null)} 
          onSave={saveAddress} 
        />
      )}
    </div>
  );
};

// --- Catalog Component ---
const Catalog: React.FC<{ language: Language }> = ({ language }) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/*<h2 className="text-5xl font-black text-slate-900 mb-12 tracking-tight">{t.catalog}</h2>*/}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {INITIAL_PRODUCTS.map(product => (
          <div key={product.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 hover:shadow-2xl transition-all duration-300 group">
            <div className="h-64 overflow-hidden relative">
              <img src={product.imageUrl} alt={product.name[language]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-6 left-6 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-800 shadow-xl">{product.type}</div>
            </div>
            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-900 mb-3">{product.name[language]}</h3>
              <p className="text-slate-500 text-sm mb-10 line-clamp-2 leading-relaxed">{product.description[language]}</p>
              <Link to={`/product/${product.id}`} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/20 group-hover:-translate-y-1">
                {t.addToCart} <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

//const AddressModal: React.FC<{
//  language: Language,
//  address?: Address,
//  onClose: () => void,
//  onSave: (addr: Address) => void
//}> = ({ language, address, onClose, onSave }) => {
//  const t = TRANSLATIONS[language];
//  const [formData, setFormData] = useState<Omit<Address, 'id'>>(
//    address ? { ...address } : { name: '', phone: '', province: '', detail: '', isDefault: false }
//  );
//
//  return (
//    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
//      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
//        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
//          <h3 className="font-black text-xl">{address ? t.edit : t.addNew}</h3>
//          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
//        </div>
//        <div className="p-10 space-y-6">
//           <div><label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t.recipientName}</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 border-slate-200 bg-slate-50/50 font-bold text-slate-700" /></div>
//           <div><label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t.phoneNumber}</label><input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 border-slate-200 bg-slate-50/50 font-bold text-slate-700" /></div>
//           <div><label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t.provinceCity}</label><select value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} className="w-full border rounded-2xl px-4 py-4 outline-none bg-slate-50/50 focus:ring-4 focus:ring-blue-100 border-slate-200 font-bold cursor-pointer text-slate-700"><option value="">{t.selectProvince}</option>{Object.keys(SHIPPING_RATES).sort().map(p => <option key={p} value={p}>{p}</option>)}</select></div>
//           <div><label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">{t.addressDetail}</label><textarea value={formData.detail} onChange={e => setFormData({...formData, detail: e.target.value})} rows={2} className="w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 border-slate-200 bg-slate-50/50 font-bold text-slate-700" /></div>
//           <button onClick={() => onSave({ ...formData, id: address?.id || Math.random().toString(36).substr(2, 9) })} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase tracking-widest">
//             {address ? t.edit : t.addNew}
//           </button>
//        </div>
//      </div>
//    </div>
//  );
//};

const AddressModal: React.FC<{
  language: Language,
  address?: Address,
  onClose: () => void,
  onSave: (addr: Address) => void
}> = ({ language, address, onClose, onSave }) => {
  const t = TRANSLATIONS[language];
  const [formData, setFormData] = useState<Omit<Address, 'id'>>(
    address ? { ...address } : { name: '', phone: '', province: '', detail: '', isDefault: false }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Omit<Address, 'id'>, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof Omit<Address, 'id'>, string>> = {};

    if (!formData.recipient_name.trim()) {
      newErrors.recipient_name = t.recipientNameRequired || '收件人姓名不能为空';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = t.phoneRequired || '手机号码不能为空';
    } else if (!/^1\d{10}$/.test(formData.phone.trim())) {
      // 简单的中文手机号验证
      newErrors.phone = t.phoneInvalid || '请输入有效的手机号码';
    }
    
    if (!formData.province) {
      newErrors.province = t.provinceRequired || '请选择省份/城市';
    }
    
    if (!formData.detail.trim()) {
      newErrors.detail = t.addressRequired || '详细地址不能为空';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return; // 验证失败，不保存
    }
    
    onSave({ 
      ...formData, 
      id: address?.id || `temp_${Math.random().toString(36).substr(2, 9)}`
    });
  };

  const handleInputChange = (field: keyof Omit<Address, 'id'>, value: string) => {
    setFormData({ ...formData, [field]: value });
    // 清除该字段的错误信息
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
          <h3 className="font-black text-xl">{address ? t.edit : t.addNew}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-10 space-y-6">
          {/* 收件人姓名 */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
              {t.recipientName}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input 
              type="text" 
              value={formData.recipient_name} 
              onChange={e => handleInputChange('recipient_name', e.target.value)} 
              className={`w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 bg-slate-50/50 font-bold text-slate-700 ${
                errors.recipient_name ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.recipient_name && <p className="text-red-500 text-xs mt-1">{errors.recipient_name}</p>}
          </div>
          
          {/* 手机号码 */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
              {t.phoneNumber}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input 
              type="tel" 
              value={formData.phone} 
              onChange={e => handleInputChange('phone', e.target.value)} 
              className={`w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 bg-slate-50/50 font-bold text-slate-700 ${
                errors.phone ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
          
          {/* 省份/城市 */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
              {t.provinceCity}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select 
              value={formData.province} 
              onChange={e => handleInputChange('province', e.target.value)} 
              className={`w-full border rounded-2xl px-4 py-4 outline-none bg-slate-50/50 focus:ring-4 focus:ring-blue-100 font-bold cursor-pointer text-slate-700 ${
                errors.province ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              <option value="">{t.selectProvince}</option>
              {Object.keys(SHIPPING_RATES).sort().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
          </div>
          
          {/* 详细地址 */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
              {t.addressDetail}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea 
              value={formData.detail} 
              onChange={e => handleInputChange('detail', e.target.value)} 
              rows={2} 
              className={`w-full border rounded-2xl px-4 py-4 outline-none focus:ring-4 focus:ring-blue-100 bg-slate-50/50 font-bold text-slate-700 ${
                errors.detail ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.detail && <p className="text-red-500 text-xs mt-1">{errors.detail}</p>}
          </div>
          
          {/* 默认地址选项（如果支持） */}
          {!address && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="defaultAddress"
                checked={formData.isDefault}
                onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="defaultAddress" className="ml-2 text-sm font-medium text-slate-700">
                设为默认地址
              </label>
            </div>
          )}
          
          {/* 保存按钮 */}
          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            {address ? t.edit : t.addNew}
          </button>
        </div>
      </div>
    </div>
  );
};

const Cart: React.FC<{ 
  cart: CartItem[], 
  language: Language, 
  setCart: (c: CartItem[]) => void,
  user: User | null,
  updateUser: (u: User) => void
}> = ({ cart, language, setCart, user, updateUser }) => {
  const t = TRANSLATIONS[language];
  const currency = getCurrency(language);
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfIncludePrice, setPdfIncludePrice] = useState(true);
  
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(user?.addresses?.[0]?.id || null);
  const [isEditingAddress, setIsEditingAddress] = useState<Address | null | 'new'>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const addresses = user?.addresses || [];
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || null;

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      setSelectedAddressId(addresses[0].id);
    }
  }, [addresses, selectedAddressId]);

  const calculateTotal = () => {
    const base = cart.reduce((acc, i) => acc + i.totalPrice, 0);
    
    let totalWeightKg = 0;
    cart.forEach(item => {
       if (item.product.type === ProductType.PROFILE) {
          const cfg = item.config as ProfileConfig;
          const weightPerM = PROFILE_WEIGHTS[cfg.variantId!] || 0.6;
          totalWeightKg += weightPerM * (cfg.length / 1000) * item.quantity;
       } else {
          totalWeightKg += 1 * item.quantity;
       }
    });

    const shipRate = selectedAddress ? (SHIPPING_RATES[selectedAddress.province] || { first: 15, next: 0 }) : { first: 0, next: 0 };
    
    let shippingFee = 0;
    if (selectedAddress) {
       // Accurate "首重 + 次重" calculation
       const roundedWeight = Math.max(1, Math.ceil(totalWeightKg));
       shippingFee = shipRate.first + (roundedWeight - 1) * shipRate.next;
    }

    return { base, ship: shippingFee, total: base + shippingFee };
  };

  const { base: baseTotal, ship: shippingFee, total: finalTotal } = calculateTotal();

  const handleGeneratePDF = async (includePrice: boolean = true, returnBase64: boolean = false) => {
    setPdfIncludePrice(includePrice);
    await new Promise(r => setTimeout(r, 600));
    const userLabel = user?.id || user?.name || 'guest';
    const filename = `${userLabel}_${finalTotal.toFixed(1)}_Mengkaile_${includePrice ? 'OrderWithPrice' : 'OrderNoPrice'}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfBase64 = await exportToPDF(printRef.current, filename, { returnBase64 });
    return { pdfBase64, filename };
  };

  const handleCheckout = async () => {
    if (!user) {
      alert("Please login or register to proceed with checkout.");
      return navigate('/login?redirect=/cart');
    }
    if (!selectedAddress) return alert("Please add and select a shipping address first.");
    
    setIsExporting(true);
    try {
      const newOrder: Order = { 
        id: Math.random().toString(36).substr(2, 6).toUpperCase(), 
        date: new Date().toISOString(), 
        items: [...cart], 
        total: finalTotal, 
        shippingFee, 
        status: 'pending', 
        userId: user.id, 
        address: selectedAddress 
      };
      
      const createdOrder = await ApiService.createOrder(newOrder);
      setPdfIncludePrice(true);
      await new Promise(r => setTimeout(r, 200));
      const { pdfBase64, filename } = await handleGeneratePDF(true, true);
      if (pdfBase64 && createdOrder?.id) {
        await ApiService.uploadOrderPdf(createdOrder.id, pdfBase64, filename);
      }
      
      alert(t.checkoutSuccess);
      setCart([]);
      navigate('/history');
    } catch (e) {
      console.error(e);
      alert("Checkout failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddNewAddress = () => {
    if (!user) {
       alert("Please register an account to save shipping addresses.");
       return navigate('/login?redirect=/cart');
    }
    setIsEditingAddress('new');
  };

  const updateCartItemQuantity = (itemId: string, newQty: number) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const qty = Math.max(1, newQty);
        const unitPrice = item.config?.unitPrice || (item.totalPrice / item.quantity);
        return {
          ...item,
          quantity: qty,
          totalPrice: parseFloat((unitPrice * qty).toFixed(2))
        };
      }
      return item;
    }));
  };

  if (cart.length === 0) return (
    <div className="max-w-4xl mx-auto p-20 text-center my-20 bg-white rounded-[3rem] border border-slate-100 shadow-2xl">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
        <ShoppingCart className="w-12 h-12 text-slate-200" />
      </div>
      <h2 className="text-4xl font-black text-slate-800 mb-3">{t.emptyCart}</h2>
      <p className="text-slate-500 mb-12 text-lg">{t.buildProject}</p>
      <Link to="/" className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black hover:bg-blue-600 transition-all inline-flex items-center gap-3 shadow-xl shadow-slate-900/10">
        {t.startShopping} <ArrowLeft className="w-5 h-5 rotate-180" />
      </Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 relative">
      <h2 className="text-5xl font-black mb-10 text-slate-900 tracking-tight">{t.cart}</h2>
      
      <div style={{ position: 'absolute', top: -9999, left: -9999, pointerEvents: 'none' }}>
        <div ref={printRef} className="w-[210mm] bg-white">
          <FactorySheet 
            cart={cart} 
            user={user} 
            language={language} 
            orderRef="PREVIEW" 
            dateStr={new Date().toLocaleDateString()} 
            showPrice={pdfIncludePrice}
            address={selectedAddress || undefined}
          />
        </div>
      </div>

      {showPreview && (
        <FactorySheetPreview 
           cart={cart} 
           user={user} 
           language={language} 
           onClose={() => setShowPreview(false)} 
           onDownload={() => handleGeneratePDF(true)} 
        />
      )}
      
      {isEditingAddress && (
        <AddressModal 
          language={language} 
          address={isEditingAddress === 'new' ? undefined : isEditingAddress} 
          onClose={() => setIsEditingAddress(null)} 
          onSave={(a) => {
            const next = isEditingAddress === 'new' ? [...addresses, a] : addresses.map(x => x.id === a.id ? a : x);
            ApiService.updateUserAddresses(next)
              .then(() => {
                // Fetch fresh user data after address update
                return ApiService.getCurrentUser();
              })
              .then(u => {
                if (u) {
                  updateUser(u);
                  setSelectedAddressId(a.id);
                  setIsEditingAddress(null);
                } else {
                  throw new Error('Failed to fetch updated user');
                }
              })
              .catch(err => {
                console.error("Failed to update address in Cart", err);
                alert("Failed to save address. Please ensure you are logged in.");
              });
          }} 
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex justify-between items-center bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100">
            <Link to="/product/p2" className="flex items-center gap-2 text-blue-600 font-black px-5 py-3 rounded-2xl hover:bg-blue-50 transition-all text-sm"><ArrowLeft className="w-4 h-4"/> {t.continueShopping}</Link>
            <div className="flex gap-2">
              <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 text-slate-700 font-bold px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all text-sm"><Eye className="w-4 h-4"/> {t.preview}</button>
              {user?.role === 'admin' && (
                <button onClick={() => handleGeneratePDF(false)} className="flex items-center gap-2 text-orange-600 font-bold px-5 py-3 rounded-2xl border border-orange-100 bg-orange-50 hover:bg-orange-100 transition-all text-sm"><FileDown className="w-4 h-4"/> {t.downloadNoPrice}</button>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800"><MapPin className="w-7 h-7 text-blue-600"/>{t.shippingAddress}</h3>
               <button onClick={handleAddNewAddress} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-black hover:bg-blue-100 transition-all">{t.addNew}</button>
             </div>
             <div className="space-y-4">
               {addresses.map(addr => (
                 <div key={addr.id} onClick={() => setSelectedAddressId(addr.id)} className={`p-6 rounded-[2rem] border-2 cursor-pointer relative group transition-all duration-300 ${selectedAddressId === addr.id ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/10' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                   {selectedAddressId === addr.id && <div className="absolute top-6 right-6 bg-blue-600 p-1.5 rounded-full text-white shadow-xl animate-in zoom-in"><CheckCircle className="w-5 h-5"/></div>}
                   <div className="font-black text-slate-900 text-xl mb-1">{addr.recipient_name} · {addr.phone}</div>
                   <div className="text-sm text-slate-500 leading-relaxed">{addr.province} {addr.detail}</div>
                   <button onClick={(e) => { e.stopPropagation(); setIsEditingAddress(addr); }} className="mt-4 flex items-center gap-1.5 text-xs font-black text-blue-600 bg-white border border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Pencil className="w-3 h-3"/>{t.edit}</button>
                 </div>
               ))}
               {addresses.length === 0 && <p className="text-slate-400 italic text-sm text-center py-6 bg-slate-50 rounded-3xl">{t.noAddress}{t.addNewAddress}</p>}
             </div>
          </div>

          <div className="space-y-6">
            {cart.map(item => {
              const profileConfig = item.config as ProfileConfig;
              const colorDef = profileConfig?.colorId ? PROFILE_COLORS.find(c => c.id === profileConfig.colorId) : null;

              return (
                <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col group hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-black text-slate-800 text-2xl mb-1">{item.product.name[language]}</h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">{t.quantity}:</span>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={(e) => updateCartItemQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-0.5 border rounded text-center text-sm font-bold bg-blue-50 border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-slate-900 mb-4">{currency}{item.totalPrice.toFixed(1)}</div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => navigate(`/product/${item.product.id}`, { state: { editItem: item } })} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"><Pencil className="w-4 h-4"/>{t.edit}</button>
                        <button onClick={() => setCart(cart.filter(x => x.id !== item.id))} className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"><Trash2 className="w-4 h-4"/>{t.remove}</button>
                      </div>
                    </div>
                  </div>
                  {item.product.type === ProductType.PROFILE && (
                    <div className="mt-8 pt-8 border-t border-slate-100">
                      <div className="flex flex-wrap gap-2 mb-6">
                        <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-full text-slate-500 uppercase">{profileConfig.variantId}</span>
                        <span className="text-[10px] font-black px-3 py-1 bg-blue-50 rounded-full text-blue-600 uppercase">{profileConfig.length}mm</span>
                        {colorDef && <span className="text-[10px] font-black px-3 py-1 bg-orange-50 rounded-full text-orange-600 uppercase">{colorDef.name[language]}</span>}
                      </div>
                      <div className="h-28 w-full max-w-lg bg-slate-50/50 rounded-[2rem] p-4">
                        <ProfileVisualizer config={item.config} selectedSide="A" onSideChange={() => {}} interactive={false} tapLabel={t.tapAction} showSideSelector={false} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-[3rem] sticky top-24 shadow-2xl border border-slate-800">
            <h3 className="text-2xl font-black mb-10 border-b border-slate-800 pb-6 flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-blue-500"/> Order Summary</h3>
            <div className="space-y-6 mb-12">
              <div className="flex justify-between text-slate-400 font-bold"><span>Subtotal</span><span className="text-white font-black text-lg">{currency}{baseTotal.toFixed(1)}</span></div>
              <div className="flex justify-between text-slate-400 font-bold"><span>Shipping</span><span className="text-white font-black text-lg">{currency}{shippingFee.toFixed(1)}</span></div>
            </div>
            <div className="flex justify-between text-4xl font-black mb-12 text-blue-400">
              <span className="text-white text-2xl">{t.total}</span>
              <span>{currency}{finalTotal.toFixed(1)}</span>
            </div>
            <button onClick={handleCheckout} disabled={isExporting} className="w-full bg-blue-600 py-6 rounded-3xl font-black hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/30 disabled:bg-slate-800 disabled:text-slate-600 uppercase tracking-widest text-lg flex items-center justify-center gap-3">
              {isExporting ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download className="w-6 h-6" /> {t.checkout}</>}
            </button>

            {/* Alipay Payment Section */}
            <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl border-2 border-blue-200 shadow-xl">
              <div className="space-y-4">
                <h4 className="text-lg font-black text-slate-900 text-center">
                  {t.alipayPayment}
                </h4>
                <p className="text-xs text-slate-600 text-center leading-relaxed">
                  {t.alipayInstructions} “上海暖橙黄信息科技有限公司”
                </p>
                <div className="flex justify-center p-4 bg-white rounded-2xl border border-slate-200">
                  <img 
                    src="images/alipay-qr.jpg" 
                    alt="Alipay QR Code" 
                    className="w-32 h-32 rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-xs text-slate-400 italic text-center">QR Code Image (Please upload alipay-qr.jpg)</p>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* WeChat Payment Section */}
            <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-slate-50 rounded-3xl border-2 border-green-200 shadow-xl">
              <div className="space-y-4">
                <h4 className="text-lg font-black text-slate-900 text-center">
                  {t.wechatPayment}
                </h4>
                <p className="text-xs text-slate-600 text-center leading-relaxed">
                  {t.wechatInstructions}
                </p>
                <div className="flex justify-center p-4 bg-white rounded-2xl border border-slate-200">
                  <img 
                    src="images/wechatpay-qr.png" 
                    alt="WeChat QR Code" 
                    className="w-32 h-32 rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-xs text-slate-400 italic text-center">QR Code Image (Please upload wechatpay-qr.png)</p>';
                      }
                    }}
                  />
                </div>
                <p className="text-xs font-bold text-slate-700 text-center bg-green-100 py-2 px-3 rounded-2xl">
                  {t.wechatPhone}
                </p>
              </div>
            </div>

            {/* WeChat Payment Section */}
            <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-slate-50 rounded-3xl border-2 border-green-200 shadow-xl">
              <div className="space-y-4">
                <h4 className="text-lg font-black text-slate-900 text-center">
                  {t.afterpay}
                </h4>
                <p className="text-xs text-slate-600 text-center leading-relaxed">
                  {t.afterpayinstructions}
                </p>
                <div className="flex justify-center p-4 bg-white rounded-2xl border border-slate-200">
                  <img 
                    src="images/wechat-qr.jpg" 
                    alt="WeChat QR Code" 
                    className="w-32 h-32 rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-xs text-slate-400 italic text-center">QR Code Image (Please upload wechat-qr.jpg)</p>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductDetail: React.FC<{
  language: Language,
  onAddToCart: (item: CartItem) => void,
  onAddBatchToCart: (items: CartItem[]) => void,
  onUpdateCartItem: (item: CartItem) => void,
  draftProfiles: CartItem[],
  setDraftProfiles: React.Dispatch<React.SetStateAction<CartItem[]>>
}> = ({ language, onAddToCart, onAddBatchToCart, onUpdateCartItem, draftProfiles, setDraftProfiles }) => {
  const { id } = useParams();
  const location = useLocation();
  const product = INITIAL_PRODUCTS.find(p => p.id === id);
  const t = TRANSLATIONS[language];

  const editItem = location.state?.editItem as CartItem | undefined;

  if (!product) return <div className="p-20 text-center font-bold">Product Not Found</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> {t.home}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1">
           <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden sticky top-24">
             <img src={product.imageUrl} alt={product.name[language]} className="w-full h-56 object-cover rounded-3xl mb-8 shadow-md" />
             <h2 className="text-3xl font-black text-slate-900 mb-4">{product.name[language]}</h2>
             <p className="text-slate-500 text-sm leading-relaxed mb-8">{product.description[language]}</p>
             <div className="flex items-center gap-2 text-blue-600 font-black text-xs uppercase bg-blue-50 px-3 py-1.5 rounded-full w-fit">
               <Package className="w-4 h-4" /> {product.type}
             </div>
           </div>
        </div>
        <div className="lg:col-span-3">
          {product.type === ProductType.PROFILE ? (
            <ProfileEditor 
              language={language} 
              product={product} 
              initialItem={editItem}
              onAddBatchToCart={onAddBatchToCart}
              onUpdateItem={onUpdateCartItem}
              draftProfiles={draftProfiles}
              setDraftProfiles={setDraftProfiles}
            />
          ) : product.type === ProductType.PEGBOARD || product.type === ProductType.CABINET_DOOR ? (
            <SharedBoardEditor
              product={product}
              onAddToCart={(item) => onAddToCart(item)}
            />
          ) : product.type === ProductType.FRAME ? (
            <FrameEditor
              product={product}
              onAddToCart={(item) => onAddToCart(item)}
            />
          ) : product.type === ProductType.SHUFATE_CABINET ? (
            <ShufateCabinetEditor
              product={product}
              onAddToCart={(item) => onAddToCart(item)}
            />
          ) : (
            <div className="p-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                 <Package className="w-10 h-10 text-slate-200" />
               </div>
               <p className="font-black text-slate-400 text-xl max-w-xs">{t.framePlaceholder}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('cn');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draftProfiles, setDraftProfiles] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const t = TRANSLATIONS[language];

  useEffect(() => { 
    ApiService.getCurrentUser().then(setUser);
  }, []);

  const onEditOrder = (o: Order) => {
    setCart(mergeCartItems([], o.items));
    window.location.hash = '/cart';
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 pb-20">
        <nav className="bg-white/90 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-5 group">
              <div className="w-14 h-14 bg-slate-900 rounded-[1.25rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-slate-900/20 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-500">M</div>
              <span className="font-black text-2xl tracking-tight hidden sm:block">{t.title}</span>
            </Link>
            
            <div className="flex items-center gap-4 sm:gap-10">
              <div className="hidden lg:flex gap-10 items-center">
                {/*<Link to="/" className="text-sm font-black text-slate-500 hover:text-blue-600 transition-all tracking-widest uppercase">{t.catalog}</Link>*/}
                {user && <Link to="/history" className="text-sm font-black text-slate-500 hover:text-blue-600 transition-all tracking-widest uppercase">{t.history}</Link>}
              </div>
              {/* Mobile: quick history icon */}
              {user && (
                <Link to="/history" className="sm:hidden p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center hover:bg-white transition-all" aria-label={t.history}>
                  <History className="w-5 h-5 text-slate-600" />
                </Link>
              )}
              <LanguageSwitcher current={language} onChange={setLanguage} />
              
              {user ? (
                <div className="flex items-center gap-4">
                  <Link to="/history" className="hidden sm:flex items-center gap-3 px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-xl transition-all group">
                     <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                     <span className="text-sm font-black text-slate-800">{user.name}</span>
                  </Link>
                  <button onClick={() => ApiService.logout().then(() => setUser(null))} className="p-4 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-[1.25rem] transition-all shadow-lg shadow-red-500/5"><LogOut className="w-6 h-6"/></button>
                </div>
              ) : (
                <Link to="/login" className="bg-slate-900 text-white px-8 py-4 rounded-[1.25rem] text-sm font-black shadow-2xl shadow-slate-900/10 hover:bg-blue-600 transition-all tracking-widest uppercase">{t.login}</Link>
              )}

              <Link to="/cart" className="relative p-4 bg-blue-600 text-white rounded-[1.25rem] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 transition-all hover:scale-110 active:scale-90">
                <ShoppingCart className="w-6 h-6" />
                {cart.length > 0 && <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[12px] w-8 h-8 flex items-center justify-center rounded-full border-4 border-white font-black shadow-2xl animate-bounce">{cart.length}</span>}
              </Link>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Catalog language={language} />} />
          <Route path="/login" element={<Auth language={language} onLogin={(u) => { setUser(u); }} />} />
          <Route path="/history" element={user ? <UserProfile user={user} language={language} setUser={setUser} onEditOrder={onEditOrder} /> : <div className="p-40 text-center flex flex-col items-center"><UserIcon className="w-20 h-20 text-slate-100 mb-6"/><p className="font-black text-slate-300 text-2xl">Please login to view your orders</p></div>} />
          <Route path="/product/:id" element={<ProductDetail language={language} onAddToCart={(item) => setCart(mergeCartItems(cart, [item]))} onAddBatchToCart={(items) => setCart(mergeCartItems(cart, items))} onUpdateCartItem={(item) => setCart(cart.map(x => x.id === item.id ? item : x))} draftProfiles={draftProfiles} setDraftProfiles={setDraftProfiles} />} />
          <Route path="/cart" element={<Cart cart={cart} language={language} setCart={setCart} user={user} updateUser={setUser} />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
