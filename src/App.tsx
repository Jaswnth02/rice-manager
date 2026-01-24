import React, { useState, useEffect } from 'react';
import {
  Users,
  Home,
  FileText,
  Plus,
  LogOut,
  Search,
  AlertCircle,
  CreditCard,
  IndianRupee,
  ShoppingBag
} from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import {
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  setDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

// --- Types ---
type ViewState = 'DASHBOARD' | 'CUSTOMERS' | 'TRANSACTIONS' | 'REPORTS';
type Location = 'Mothepalayam' | 'Mettupalayam' | 'Sirumugai' | 'Karamadai' | 'Alangombu' | 'Sankar Nagar';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  location: Location;
  balance: number;
  createdAt: any;
}

interface Transaction {
  id: string;
  customerId: string;
  customerName: string; // Denormalized for easier display
  type: 'SALE' | 'PAYMENT';
  amount: number;
  date: any;
  details?: {
    brand?: string;
    bags?: number;
    pricePerBag?: number;
    notes?: string;
  };
}

// --- Main Component ---
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [authError, setAuthError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [showBrandManager, setShowBrandManager] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);

  // Fetch Brands
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists() && docSnap.data().brands) {
        setBrands(docSnap.data().brands);
      } else {
        setBrands(['Sona Masoori', 'Basmati', 'Ponni Rice', 'Idly Rice']);
      }
    });
    return () => unsub();
  }, [user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    }, (error) => {
      console.error("Auth Error:", error);
      // Handle unauthorized domain specifically
      if (error.message.includes("auth/unauthorized-domain")) {
        setAuthError("DOMAIN_ERROR");
      }
    });
    return () => unsubscribe();
  }, []);

  // Permission Check
  useEffect(() => {
    if (!user) return;
    const checkPermissions = async () => {
      try {
        // Try reading a dummy query to check if rules allow read
        await getDocs(query(collection(db, `users/${user.uid}/customers`), limit(1)));
      } catch (error: any) {
        console.error("Permission Check Error:", error);
        if (error.code === 'permission-denied') {
          setPermissionError(true);
        }
      }
    };
    checkPermissions();
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("DOMAIN_ERROR");
      } else if (error.code === 'auth/api-key-not-valid' || error.code === 'auth/invalid-api-key') {
        setAuthError("CONFIG_ERROR");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError("PROVIDER_ERROR");
      } else {
        alert("Login Failed: " + error.message);
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Guest Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("DOMAIN_ERROR");
      } else if (error.code === 'auth/api-key-not-valid' || error.code === 'auth/invalid-api-key') {
        setAuthError("CONFIG_ERROR");
      } else {
        alert("Login Failed: " + error.message);
      }
    }
  };

  const handleBackToCustomers = () => {
    setActiveCustomer(null);
    setCurrentView('CUSTOMERS');
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50">Loading...</div>;

  if (authError === "DOMAIN_ERROR") {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-red-50 text-center">
        <AlertCircle size={48} className="text-red-600 mb-4" />
        <h1 className="text-xl font-bold text-red-900 mb-2">Unauthorized Domain</h1>
        <p className="mb-4 text-red-700">Please add this domain to Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains:</p>
        <code className="bg-red-100 p-2 rounded text-sm select-all">{window.location.hostname}</code>
      </div>
    );
  }

  if (authError === "PROVIDER_ERROR") {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-blue-50 text-center">
        <AlertCircle size={48} className="text-blue-600 mb-4" />
        <h1 className="text-xl font-bold text-blue-900 mb-2">Google Sign-In Not Enabled</h1>
        <p className="mb-4 text-blue-800 max-w-md">
          Google Authentication is disabled in your Firebase project.
        </p>
        <div className="bg-blue-100 p-4 rounded-xl text-left text-sm text-blue-900 border border-blue-200">
          <p className="font-bold mb-2">How to enable:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Go to Firebase Console &gt; Authentication &gt; Sign-in method.</li>
            <li>Click on <b>Google</b>.</li>
            <li>Toggle <b>Enable</b> switch to On.</li>
            <li>Click <b>Save</b>.</li>
          </ol>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
        >
          Reload App
        </button>
      </div>
    );
  }

  if (authError === "CONFIG_ERROR") {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-yellow-50 text-center">
        <AlertCircle size={48} className="text-yellow-600 mb-4" />
        <h1 className="text-xl font-bold text-yellow-900 mb-2">Missing Firebase Configuration</h1>
        <p className="mb-4 text-yellow-800 max-w-md">
          The app cannot connect to Firebase because the API Key is missing or invalid.
        </p>
        <div className="bg-yellow-100 p-4 rounded-xl text-left text-sm text-yellow-900 border border-yellow-200">
          <p className="font-bold mb-2">How to fix:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open <code className="font-mono bg-yellow-200 px-1 rounded">src/firebase.ts</code></li>
            <li>Replace the placeholder values with your actual Firebase project config.</li>
            <li>Save the file.</li>
          </ol>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-700"
        >
          Reload App
        </button>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 bg-orange-50 text-center">
        <AlertCircle size={48} className="text-orange-600 mb-4" />
        <h1 className="text-xl font-bold text-orange-900 mb-2">Database Permissions Missing</h1>
        <p className="mb-4 text-orange-700">Please update your Firestore Security Rules:</p>
        <pre className="bg-orange-100 p-4 rounded text-left text-xs overflow-auto w-full max-w-md select-all border border-orange-200">
          {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}`}
        </pre>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-emerald-50 p-6 text-gray-900">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
          <div className="bg-emerald-100 p-4 rounded-full inline-block mb-4">
            <ShoppingBag size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Rice Manager</h1>
          <p className="text-gray-500 mb-8">Digital Ledger for your Shop</p>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium mb-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>

          <button
            onClick={handleGuestLogin}
            className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Guest Mode (Test)
          </button>
        </div>
      </div>
    );
  }

  // Determine main content based on state
  let content;
  if (activeCustomer) {
    content = <CustomerPassbook user={user} customer={activeCustomer} onBack={handleBackToCustomers} brands={brands} />;
  } else if (currentView === 'DASHBOARD') {
    content = <Dashboard user={user} onManageDetails={() => setShowBrandManager(true)} />;
  } else if (currentView === 'CUSTOMERS') {
    content = <CustomersView user={user} onSelectCustomer={setActiveCustomer} />;
  } else if (currentView === 'REPORTS') {
    content = <ReportsView user={user} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">Rice Manager</h1>
          <button onClick={() => signOut(auth)} className="p-2 bg-emerald-700 rounded-full hover:bg-emerald-800">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4">
        {content}
      </main>

      {/* Bottom Navigation */}
      {!activeCustomer && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center text-xs font-medium text-gray-500 z-20">
          <button
            onClick={() => setCurrentView('DASHBOARD')}
            className={`flex flex-col items-center gap-1 ${currentView === 'DASHBOARD' ? 'text-emerald-600' : ''}`}
          >
            <Home size={24} />
            <span>Home</span>
          </button>
          <button
            onClick={() => setCurrentView('CUSTOMERS')}
            className={`flex flex-col items-center gap-1 ${currentView === 'CUSTOMERS' ? 'text-emerald-600' : ''}`}
          >
            <Users size={24} />
            <span>Customers</span>
          </button>
          <button
            onClick={() => setCurrentView('REPORTS')}
            className={`flex flex-col items-center gap-1 ${currentView === 'REPORTS' ? 'text-emerald-600' : ''}`}
          >
            <FileText size={24} />
            <span>Reports</span>
          </button>
        </nav>
      )}

      {showBrandManager && (
        <BrandManager user={user} onClose={() => setShowBrandManager(false)} />
      )}
    </div>
  );
}

// --- Sub Components ---

// --- Sub Components ---

function Dashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({
    pending: 0,
    collectedToday: 0,
    salesToday: 0
  });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);

  useEffect(() => {
    // 1. Listen for Recent Activity (limit 5)
    // Ordered by date desc
    const qTx = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc'),
      limit(5)
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      setRecentTx(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[]);
    });

    // 2. Calculate Stats
    // Ideally, for scale, we use Cloud Functions to aggregate. 
    // For this size, client-side aggregation or reading from a stats document is fine. 
    // We will do a hybrid: Read all customers for Balance, and Transactions of "Today" for daily stats.

    // Total Pending: Sum of all customer balances > 0
    const qCust = query(collection(db, `users/${user.uid}/customers`));
    const unsubCust = onSnapshot(qCust, (snap) => {
      const totalPending = snap.docs.reduce((acc, doc) => {
        const bal = doc.data().balance || 0;
        return bal > 0 ? acc + bal : acc;
      }, 0);
      setStats(prev => ({ ...prev, pending: totalPending }));
    });

    // Daily Stats: Query transactions where date >= startOfToday
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const qDaily = query(
      collection(db, `users/${user.uid}/transactions`),
      where('date', '>=', Timestamp.fromDate(startOfToday))
    );
    const unsubDaily = onSnapshot(qDaily, (snap) => {
      let collected = 0;
      let sales = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'PAYMENT') collected += (data.amount || 0);
        if (data.type === 'SALE') sales += (data.amount || 0);
      });
      setStats(prev => ({ ...prev, collectedToday: collected, salesToday: sales }));
    });

    return () => {
      unsubTx();
      unsubCust();
      unsubDaily();
    };
  }, [user.uid]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-50 col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <AlertCircle size={80} className="text-red-500" />
          </div>
          <p className="text-gray-500 text-sm mb-1 uppercase tracking-wider font-semibold">Total Pending</p>
          <p className="text-4xl font-black text-red-600">₹ {stats.pending.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
          <p className="text-gray-400 text-xs mb-1 uppercase font-bold">Collected Today</p>
          <p className="text-xl font-black text-emerald-600">₹ {stats.collectedToday.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-50">
          <p className="text-gray-400 text-xs mb-1 uppercase font-bold">Sales Today</p>
          <p className="text-xl font-black text-blue-600">₹ {stats.salesToday.toLocaleString('en-IN')}</p>
        </div>
        </div>
      </div>

      <button
        onClick={onManageDetails}
        className="w-full py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2"
      >
        <span>Add or Modify Details</span>
      </button>

      <div>
        <h3 className="text-gray-800 font-bold mb-3 text-sm uppercase tracking-wide opacity-70">Recent Activity</h3>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {recentTx.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">No recent transactions</div>
          ) : (
            recentTx.map(t => (
              <div key={t.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${t.type === 'SALE' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                    {t.type === 'SALE' ? <ShoppingBag size={16} /> : <IndianRupee size={16} />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{t.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {t.type === 'SALE' ? 'New Sale' : 'Payment Received'} • {t.date?.toDate ? t.date.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
                <span className={`font-bold ${t.type === 'SALE' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {t.type === 'SALE' ? '+' : '-'} ₹{t.amount}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div >
  );
}

function CustomersView({ user, onSelectCustomer }: { user: User, onSelectCustomer: (c: Customer) => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterLocation, setFilterLocation] = useState<Location | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Fetch Customers
  useEffect(() => {
    const q = query(collection(db, `users/${user.uid}/customers`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customerData);
    }, (error) => {
      console.error("Error fetching customers:", error);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const filteredCustomers = customers.filter(c => {
    const matchesLoc = filterLocation === 'All' || c.location === filterLocation;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    return matchesLoc && matchesSearch;
  });

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Customers</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 text-white p-2 rounded-lg flex items-center gap-1 shadow-sm hover:bg-emerald-700"
        >
          <Plus size={20} />
          <span className="text-sm font-medium">Add New</span>
        </button>
      </div>

      {showAddForm ? (
        <AddCustomerForm user={user} onCancel={() => setShowAddForm(false)} />
      ) : (
        <>
          {/* Search & Filter */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none shadow-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'Mothepalayam', 'Mettupalayam', 'Sirumugai', 'Karamadai', 'Alangombu', 'Sankar Nagar'].map((loc) => (
                <button
                  key={loc}
                  onClick={() => setFilterLocation(loc as any)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterLocation === loc
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Customer List */}
          <div className="space-y-3">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users size={48} className="mx-auto mb-2 opacity-20" />
                <p>No customers found</p>
              </div>
            ) : (
              filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div>
                    <h3 className="font-bold text-gray-800">{customer.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{customer.location}</span>
                      <span>{customer.phone}</span>
                    </div>
                  </div>
                  <div className={`text-right font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    <p className="text-sm text-gray-400 font-normal">Balance</p>
                    <p>₹ {customer.balance}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerPassbook({ user, customer, onBack, brands }: { user: User, customer: Customer, onBack: () => void, brands: string[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);

  // ... (existing useEffect) ...

  const handleTransactionSuccess = () => {
    setShowAddMoney(false);
    setShowAddSale(false);
  };

  if (showAddMoney) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md relative">
          <button
            onClick={() => setShowAddMoney(false)}
            className="absolute -top-12 right-0 text-white p-2"
          >
            Close
          </button>
          <TransactionForm
            type="PAYMENT"
            user={user}
            customer={customer}
            onSuccess={handleTransactionSuccess}
            brands={brands}
          />
        </div>
      </div>
    );
  }

  if (showAddSale) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md relative">
          <button
            onClick={() => setShowAddSale(false)}
            className="absolute -top-12 right-0 text-white p-2"
          >
            Close
          </button>
          <TransactionForm
            type="SALE"
            user={user}
            customer={customer}
            onSuccess={handleTransactionSuccess}
            brands={brands}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ... existing render ... */}

      const [activeTab, setActiveTab] = useState<'HISTORY' | 'SALE' | 'PAYMENT'>('HISTORY');
      const [transactions, setTransactions] = useState<Transaction[]>([]);

      // Real-time listener for THIS customer's balance updates
      const [liveCustomer, setLiveCustomer] = useState(customer);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/customers`, customer.id), (doc) => {
      if (doc.exists()) setLiveCustomer({id: doc.id, ...doc.data() } as Customer);
    });
    return () => unsub();
  }, [user.uid, customer.id]);


  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      where('customerId', '==', customer.id),
      orderBy('date', 'desc')
      );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[]);
    });
    return () => unsubscribe();
  }, [user.uid, customer.id]);

      return (
      <div className="pb-4">
        {/* Navbar for Passbook */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-800">{liveCustomer.name}</h2>
        </div>

        {/* Customer Summary Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <CreditCard size={100} className="text-emerald-500" />
          </div>
          <p className="text-gray-500 text-sm mb-1 uppercase tracking-wider">Current Balance</p>
          <p className={`text-4xl font-black ${liveCustomer.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            ₹ {liveCustomer.balance}
          </p>
          <p className="text-xs text-gray-400 mt-2">{liveCustomer.location} • {liveCustomer.phone}</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
          {(['HISTORY', 'SALE', 'PAYMENT'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'SALE' ? '+ SALE' : tab === 'PAYMENT' ? '+ PAYMENT' : 'HISTORY'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No transactions yet</div>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className={`text-xs font-bold uppercase mb-1 ${t.type === 'SALE' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {t.type}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t.type === 'SALE'
                          ? `${t.details?.bags} bags • ${t.details?.brand}`
                          : t.details?.notes || 'Cash Payment'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.date?.toDate ? t.date.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </p>
                    </div>
                    <div className={`font-bold text-lg ${t.type === 'SALE' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {t.type === 'SALE' ? '+' : '-'} ₹{t.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'SALE' && (
            <TransactionForm
              type="SALE"
              user={user}
              customer={liveCustomer}
              onSuccess={() => setActiveTab('HISTORY')}
            />
          )}

          {activeTab === 'PAYMENT' && (
            <TransactionForm
              type="PAYMENT"
              user={user}
              customer={liveCustomer}
              onSuccess={() => setActiveTab('HISTORY')}
            />
          )}
        </div>
      </div>
      );
}

      function TransactionForm({type, user, customer, onSuccess, brands}: {type: 'SALE' | 'PAYMENT', user: User, customer: Customer, onSuccess: () => void, brands: string[] }) {
  const [loading, setLoading] = useState(false);
      const [formData, setFormData] = useState({
        brand: 'Sona Masoori',
      bags: 1,
      pricePerBag: 0,
      amount: 0, // For Payment
      notes: '',
      paidNow: 0 // Partial Payment for SALE
  });

      const totalSaleAmount = type === 'SALE' ? (formData.bags * formData.pricePerBag) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
      setLoading(true);

      try {
      const batchPromises = [];
      const timestamp = serverTimestamp();

      // 1. Create Main Transaction Record
      const amount = type === 'SALE' ? totalSaleAmount : formData.amount;

      const mainTxData: any = {
        customerId: customer.id,
      customerName: customer.name,
      type: type,
      amount: amount,
      date: timestamp,
      };

      if (type === 'SALE') {
        mainTxData.details = {
          brand: formData.brand,
          bags: formData.bags,
          pricePerBag: formData.pricePerBag
        };
      } else {
        mainTxData.details = { notes: formData.notes };
      }

      batchPromises.push(addDoc(collection(db, `users/${user.uid}/transactions`), mainTxData));

      // 2. Handle Partial Payment (If SALE and paidNow > 0)
      if (type === 'SALE' && formData.paidNow > 0) {
        batchPromises.push(addDoc(collection(db, `users/${user.uid}/transactions`), {
          customerId: customer.id,
          customerName: customer.name,
          type: 'PAYMENT',
          amount: formData.paidNow,
          date: timestamp,
          details: { notes: 'Partial payment for sale' }
        }));
      }

      // 3. Update Customer Balance
      let newBalance = customer.balance;
      if (type === 'SALE') {
        newBalance = customer.balance + totalSaleAmount - formData.paidNow;
      } else {
        newBalance = customer.balance - formData.amount;
      }

      batchPromises.push(updateDoc(doc(db, `users/${user.uid}/customers`, customer.id), {
        balance: newBalance
      }));

      await Promise.all(batchPromises);
      onSuccess();

    } catch (err) {
        console.error("Transaction failed:", err);
      alert("Transaction failed");
    } finally {
        setLoading(false);
    }
  };

      return (
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">

        {type === 'SALE' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rice Brand</label>
              <select
                className="w-full p-3 border border-gray-200 rounded-xl bg-white"
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
              >
                <option value="" disabled>Select Brand</option>
                {brands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bags</label>
                <input
                  type="number" min="1"
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  value={formData.bags}
                  onChange={e => setFormData({ ...formData, bags: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price/Bag</label>
                <input
                  type="number" min="0" placeholder="0"
                  className="w-full p-3 border border-gray-200 rounded-xl"
                  value={formData.pricePerBag || ''}
                  onChange={e => setFormData({ ...formData, pricePerBag: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-500 uppercase">Total Amount</p>
              <p className="text-2xl font-bold text-gray-800">₹ {totalSaleAmount}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now (Optional)</label>
              <input
                type="number" min="0" placeholder="0"
                className="w-full p-3 border border-emerald-100 bg-emerald-50 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.paidNow || ''}
                onChange={e => setFormData({ ...formData, paidNow: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">If entered, creates a Payment record automatically.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
              <input
                required min="1"
                type="number"
                className="w-full p-3 border border-gray-200 rounded-xl text-xl font-bold text-emerald-600"
                placeholder="0"
                value={formData.amount || ''}
                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl"
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold shadow-md text-white mt-4 disabled:opacity-50 ${type === 'SALE' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
        >
          {loading ? 'Processing...' : (type === 'SALE' ? 'Record Sale' : 'Record Payment')}
        </button>
      </form>
      );
}

      function AddCustomerForm({user, onCancel}: {user: User, onCancel: () => void }) {
  const [step, setStep] = useState(1);
      const [formData, setFormData] = useState({
        name: '',
      phone: '',
      address: '',
      location: '' as Location | ''
  });
      const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
      if (!formData.location || !formData.name) return;

      setLoading(true);
      try {
        await addDoc(collection(db, `users/${user.uid}/customers`), {
          ...formData,
          balance: 0,
          createdAt: serverTimestamp()
        });
      onCancel();
    } catch (err) {
        console.error("Error adding customer:", err);
      alert("Failed to add customer");
    } finally {
        setLoading(false);
    }
  };

      return (
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">
            {step === 1 ? 'Select Location' : 'Customer Details'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-3">
            {['Mothepalayam', 'Mettupalayam', 'Sirumugai', 'Karamadai', 'Alangombu', 'Sankar Nagar'].map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setFormData(prev => ({ ...prev, location: loc as Location }));
                  setStep(2);
                }}
                className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-left font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all active:scale-[0.98]"
              >
                {loc}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-800 text-sm font-medium mb-4 flex justify-between items-center">
              <span>Location: {formData.location}</span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-emerald-600 underline text-xs"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                type="text"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                required
                type="tel"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                rows={2}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700 disabled:opacity-50 mt-4"
            >
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
          </form>
        )}
      </div>
      );
}

      // --- Reports View ---

      function ReportsView({user}: {user: User }) {
  const [generating, setGenerating] = useState(false);

  // Helper to download CSV
  const downloadCSV = (data: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + data.map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportBalances = async () => {
        setGenerating(true);
      try {
        // Using onSnapshot to get data once for simplicity, but getDocs is more standard for one-off. 
        // Sticking to consistent patterns or just simple fetch.
        // Better to use getDocs here but importing it might be extra char overhead if not already imported.
        // We will assume getDocs is available or use onSnapshot with a promise wrapper if needed.
        // Let's import getDocs at the top level or use the pattern we have. 
        // Actually, let's keep it simple and just listen for one snapshot.

        // WAIT: I didn't import getDocs. I'll rely on a temporary listener.
        // Optimization: Just allow the user to wait a sec. 
        // Actually for this implementation I will trust that standard CSV generation is enough.

        // Let's assume we can fetch data. I'll implement a quick one-off listner helper.
        new Promise<any[]>((resolve, reject) => {
          const unsub = onSnapshot(collection(db, `users/${user.uid}/customers`), (snap) => {
            const data = snap.docs.map(d => {
              const val = d.data();
              return [val.name, val.phone, val.location, val.balance];
            });
            resolve(data);
            unsub();
          }, reject);
        }).then(data => {
          const header = ["Name", "Phone", "Location", "Balance"];
          downloadCSV([header, ...data], "customer_balances.csv");
        });

    } catch (e) {
        console.error(e);
      alert("Export failed");
    } finally {
        setGenerating(false);
    }
  };

  const handleExportTransactions = async () => {
        setGenerating(true);
      try {
        new Promise<any[]>((resolve, reject) => {
          const unsub = onSnapshot(query(collection(db, `users/${user.uid}/transactions`), orderBy('date', 'desc')), (snap) => {
            const data = snap.docs.map(d => {
              const val = d.data();
              const dateStr = val.date?.toDate ? val.date.toDate().toISOString() : '';
              const details = val.type === 'SALE'
                ? `rice: ${val.details.brand}, bags: ${val.details.bags}, price: ${val.details.pricePerBag}`
                : val.details.notes;
              return [dateStr, val.customerName, val.type, val.amount, `"${details}"`];
            });
            resolve(data);
            unsub();
          }, reject);
        }).then(data => {
          const header = ["Date", "Customer", "Type", "Amount", "Details"];
          downloadCSV([header, ...data], "transactions.csv");
        });
    } catch (e) {
        console.error(e);
      alert("Export failed");
    } finally {
        setGenerating(false);
    }
  };

      return (
      <div className="pb-20">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Reports & Exports</h2>

        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">Customer Balances</h3>
              <p className="text-sm text-gray-500">List of all customer dues.</p>
            </div>
            <button
              onClick={handleExportBalances}
              disabled={generating}
              className="bg-emerald-100 text-emerald-700 p-3 rounded-xl hover:bg-emerald-200 transition-colors"
            >
              <FileText size={20} />
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">Transaction History</h3>
              <p className="text-sm text-gray-500">Full log of sales & payments.</p>
            </div>
            <button
              onClick={handleExportTransactions}
              disabled={generating}
              className="bg-blue-100 text-blue-700 p-3 rounded-xl hover:bg-blue-200 transition-colors"
            >
              <FileText size={20} />
            </button>
          </div>
        </div>

        {generating && <p className="text-center text-gray-400 mt-4 text-sm animate-pulse">Generating CSV...</p>}
      </div>
      );
}

      export default App;
