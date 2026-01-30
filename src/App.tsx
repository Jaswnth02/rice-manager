import React, { useState, useEffect, useMemo } from 'react';
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
  ShoppingBag,
  Grid,
  X,
  MapPin,
  Pencil,
  Check,
  MessageSquare,
  MessageCircle,
  Send,
  Trash2,
  RotateCcw,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import {
  signInWithPopup,
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
  arrayRemove,
  writeBatch,
  deleteDoc,
  runTransaction,
  type QuerySnapshot,
  type DocumentData
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// --- Utility Functions ---
function useLongPress(callback: () => void, ms = 1000) {
  const timerRef = React.useRef<any>(null);

  const start = () => {
    timerRef.current = setTimeout(callback, ms);
  };

  const stop = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// --- Types ---
type ViewState = 'DASHBOARD' | 'CUSTOMERS' | 'TRANSACTIONS' | 'REPORTS' | 'INVENTORY';
type Location = string;

interface MessageTemplate {
  name: string;
  content: string;
}

interface ShopSettings {
  shopName: string;
  ownerName: string;
  mobile: string;
}

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
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [showMessageManager, setShowMessageManager] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Fetch Brands and Locations
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.brands) setBrands(data.brands);
        else setBrands(['Sona Masoori', 'Basmati', 'Ponni Rice', 'Idly Rice']);

        if (data.locations) setLocations(data.locations);
        else setLocations(['Mothepalayam', 'Mettupalayam', 'Sirumugai', 'Karamadai', 'Alangombu', 'Sankar Nagar']);
      } else {
        setBrands(['Sona Masoori', 'Basmati', 'Ponni Rice', 'Idly Rice']);
        setLocations(['Mothepalayam', 'Mettupalayam', 'Sirumugai', 'Karamadai', 'Alangombu', 'Sankar Nagar']);
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

  // Move formatCurrency outside or keep here if only used inside App but SendMessageModal is outside
  // Since SendMessageModal is outside App, formatCurrency needs to be available. 
  // We already moved it up in first chunk. 
  // So we remove the local definition inside App if it exists, or just leave it if I didn't verify it was inside.
  // Wait, I didn't see where it was defined before. Based on usage, it was likely inside App or Passbook.
  // I will assume it was inside App or Passbook and remove it if found.
  // Actually, let's just make sure it's not redefined.

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Grain & Gain</h1>
          <p className="text-gray-500 mb-8">Digital Ledger for your Shop</p>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium mb-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>


        </div>
      </div>
    );
  }

  const handleDeleteTransaction = (tx: Transaction) => {
    setTxToDelete(tx);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!txToDelete) return;

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get current customer data for balance update
        const customerRef = doc(db, `users/${user.uid}/customers`, txToDelete.customerId);
        const customerSnap = await transaction.get(customerRef);

        if (customerSnap.exists()) {
          const currentBalance = customerSnap.data().balance || 0;
          let newBalance = currentBalance;

          // 2. Reverse Balance Calculation
          if (txToDelete.type === 'SALE') {
            // If it was a sale, we added to balance (debt increased). Now we subtract.
            newBalance = currentBalance - txToDelete.amount;
          } else {
            // If it was a payment, we subtracted from balance (debt decreased). Now we add back.
            newBalance = currentBalance + txToDelete.amount;
          }

          // 4. Update Customer Balance
          transaction.update(customerRef, { balance: newBalance });
        } else {
          console.warn("Customer not found, skipping balance update");
        }

        // 3. Reverse Inventory (if it was a SALE with brand details)
        if (txToDelete.type === 'SALE' && txToDelete.details?.brand && txToDelete.details?.bags) {
          const inventoryRef = doc(db, `users/${user.uid}/inventory`, txToDelete.details.brand);
          const invSnap = await transaction.get(inventoryRef);

          if (invSnap.exists()) {
            const currentStock = invSnap.data().count || 0;
            transaction.update(inventoryRef, {
              count: currentStock + txToDelete.details.bags,
              lastUpdated: serverTimestamp()
            });
          }
        }



        // 5. Delete Transaction Document
        const txRef = doc(db, `users/${user.uid}/transactions`, txToDelete.id);
        transaction.delete(txRef);
      });

      // alert("Transaction deleted successfully");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Failed to delete transaction");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setTxToDelete(null);
    }
  };

  // Determine main content based on state
  let content;
  if (activeCustomer) {
    content = <CustomerPassbook user={user} customer={activeCustomer} onBack={handleBackToCustomers} brands={brands} locations={locations} onDeleteTransaction={handleDeleteTransaction} />
  } else if (currentView === 'DASHBOARD') {
    content = <Dashboard user={user} onManageDetails={() => setShowBrandManager(true)} onManageLocations={() => setShowLocationManager(true)} onManageMessages={() => setShowMessageManager(true)} onDeleteTransaction={handleDeleteTransaction} />;
  } else if (currentView === 'CUSTOMERS') {
    content = <CustomersView user={user} onSelectCustomer={setActiveCustomer} locations={locations} />;
  } else if (currentView === 'REPORTS') {
    content = <ReportsView user={user} />;
  } else if (currentView === 'INVENTORY') {
    content = <InventoryView user={user} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">Grain & Gain</h1>
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
            onClick={() => setCurrentView('INVENTORY')}
            className={`flex flex-col items-center gap-1 ${currentView === 'INVENTORY' ? 'text-emerald-600' : ''}`}
          >
            <Layers size={24} />
            <span>Stock</span>
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
      {showLocationManager && (
        <LocationManager user={user} onClose={() => setShowLocationManager(false)} />
      )}
      {showMessageManager && (
        <MessageManager user={user} onClose={() => setShowMessageManager(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl scale-100 animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Transaction?</h3>
              <p className="text-gray-500 text-sm mt-2">
                Do you want to delete this transaction? This will reverse the balance changes.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                No
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-200"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

// --- Sub Components ---

function Dashboard({ user, onManageDetails, onManageLocations, onManageMessages, onDeleteTransaction }: { user: User, onManageDetails: () => void, onManageLocations: () => void, onManageMessages: () => void, onDeleteTransaction: (tx: Transaction) => void }) {
  const [stats, setStats] = useState({
    pending: 0,
    collectedToday: 0,
    salesToday: 0
  });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);

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


      <button
        onClick={() => setShowFeaturesMenu(true)}
        className="w-full py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold rounded-xl shadow-sm hover:bg-emerald-100 flex items-center justify-center gap-2"
      >
        <Grid size={18} />
        <span>Custom Features</span>
      </button>

      {showFeaturesMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 relative animate-in slide-in-from-bottom-10 fade-in">
            <button
              onClick={() => setShowFeaturesMenu(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Custom Features</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  onManageDetails();
                  setShowFeaturesMenu(false);
                }}
                className="w-full p-4 bg-gray-50 rounded-xl flex items-center gap-3 hover:bg-emerald-50 transition-colors border border-gray-100"
              >
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <ShoppingBag size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Rice Brand Manager</p>
                  <p className="text-xs text-gray-500">Add or remove rice varieties</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onManageLocations();
                  setShowFeaturesMenu(false);
                }}
                className="w-full p-4 bg-gray-50 rounded-xl flex items-center gap-3 hover:bg-emerald-50 transition-colors border border-gray-100"
              >
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <MapPin size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Location Manager</p>
                  <p className="text-xs text-gray-500">Manage delivery locations</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onManageMessages();
                  setShowFeaturesMenu(false);
                }}
                className="w-full p-4 bg-gray-50 rounded-xl flex items-center gap-3 hover:bg-emerald-50 transition-colors border border-gray-100"
              >
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <MessageCircle size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Message Manager</p>
                  <p className="text-xs text-gray-500">Create SMS templates</p>
                </div>
              </button>

              {/* Placeholder for future features */}
              {/* <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-sm">
                More features coming soon...
              </div> */}
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-gray-800 font-bold mb-3 text-sm uppercase tracking-wide opacity-70">Recent Activity</h3>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {recentTx.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">No recent transactions</div>
          ) : (
            recentTx.map(t => (
              <TransactionItem key={t.id} transaction={t} onDelete={() => onDeleteTransaction(t)} />
            ))
          )}
        </div>
      </div>
    </div >
  );
}

function TransactionItem({ transaction, onDelete }: { transaction: Transaction, onDelete: () => void }) {


  return (
    <div
      className="p-4 flex justify-between items-center select-none active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${transaction.type === 'SALE' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
          {transaction.type === 'SALE' ? <ShoppingBag size={16} /> : <IndianRupee size={16} />}
        </div>
        <div>
          <p className="font-bold text-gray-800 text-sm">{transaction.customerName}</p>
          <p className="text-xs text-gray-500">
            {transaction.type === 'SALE' ? 'New Sale' : 'Payment Received'} • {transaction.date?.toDate ? transaction.date.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-bold ${transaction.type === 'SALE' ? 'text-red-600' : 'text-emerald-600'}`}>
          {transaction.type === 'SALE' ? '+' : '-'} ₹{transaction.amount}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function CustomersView({ user, onSelectCustomer, locations }: { user: User, onSelectCustomer: (c: Customer) => void, locations: string[] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterLocation, setFilterLocation] = useState<Location | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);

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

  const handleDeleteCustomer = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${customer.name}? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/customers`, customer.id));
        // Optionally delete transactions associated? 
        // For simple app, maybe just leave them or batch delete.
        // Leaving transactions for now as "Deleted Customer" or we can implement comprehensive delete later.
        // For now user just wants to remove the customer entry from list.
      } catch (err) {
        console.error("Error deleting customer:", err);
        alert("Failed to delete customer.");
      }
    }
  };

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
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteMode(!deleteMode)}
            className={`p-2 rounded-lg flex items-center gap-1 shadow-sm transition-colors ${deleteMode ? 'bg-red-100 text-red-600' : 'bg-white text-gray-500 border border-gray-200'
              }`}
          >
            {deleteMode ? <X size={20} /> : <Trash2 size={20} />}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-emerald-600 text-white p-2 rounded-lg flex items-center gap-1 shadow-sm hover:bg-emerald-700"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">Add New</span>
          </button>
        </div>
      </div>

      {showAddForm ? (
        <AddCustomerForm user={user} onCancel={() => setShowAddForm(false)} locations={locations} />
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
              {['All', ...locations].map((loc) => (
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

          {/* Delete Mode Warning Banner */}
          {deleteMode && (
            <div className="mb-4 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">Tap any customer to permanently delete them.</p>
            </div>
          )}

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
                  onClick={(e) => {
                    console.log("Card clicked, Delete Mode:", deleteMode);
                    if (deleteMode) {
                      handleDeleteCustomer(e, customer);
                    } else {
                      onSelectCustomer(customer);
                    }
                  }}
                  className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center transition-transform ${deleteMode ? 'border-red-200 ring-1 ring-red-100 cursor-pointer hover:bg-red-50' : 'border-gray-100 active:scale-[0.99] cursor-pointer'
                    }`}
                >
                  {deleteMode && (
                    <button
                      onClick={(e) => handleDeleteCustomer(e, customer)}
                      className="mr-3 text-red-500 bg-red-50 p-2 rounded-full hover:bg-red-200"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <div className="flex-1">
                    <h3 className={`font-bold ${deleteMode ? 'text-red-900' : 'text-gray-800'}`}>{customer.name}</h3>
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

function CustomerPassbook({ user, customer, onBack, brands, locations, onDeleteTransaction }: { user: User, customer: Customer, onBack: () => void, brands: string[], locations: string[], onDeleteTransaction: (tx: Transaction) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  const [liveCustomer, setLiveCustomer] = useState(customer);

  // Real-time listener for THIS customer's balance updates
  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/customers`, customer.id), (doc) => {
      if (doc.exists()) {
        setLiveCustomer({ id: doc.id, ...doc.data() } as Customer);
      }
    });
    return () => unsub();
  }, [user.uid, customer.id]);

  // Real-time listener for transactions
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
    <div className="pb-4">
      {isEditingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md">
            <AddCustomerForm
              user={user}
              onCancel={() => setIsEditingCustomer(false)}
              locations={locations}
              initialData={liveCustomer}
            />
          </div>
        </div>
      )}

      {/* Navbar for Passbook */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <LogOut size={20} className="rotate-180" />
          </button>
          <h2 className="text-lg font-bold text-gray-800 flex-1">{liveCustomer.name}</h2>
          <button
            onClick={() => setIsEditingCustomer(true)}
            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
          >
            <Pencil size={18} />
          </button>
        </div>
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

        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={() => setShowAddSale(true)}
            className="bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all text-sm flex items-center gap-2"
          >
            <ShoppingBag size={16} /> New Sale
          </button>
          <button
            onClick={() => setShowAddMoney(true)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-sm flex items-center gap-2"
          >
            <IndianRupee size={16} /> Get Payment
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowSendMessage(true)}
            className="text-emerald-600 font-medium text-sm flex items-center gap-2 hover:bg-emerald-50 px-4 py-2 rounded-full transition-colors"
          >
            <MessageSquare size={16} />
            <span>Send Message</span>
          </button>
        </div>
      </div>

      <h3 className="text-gray-800 font-bold mb-3 text-sm uppercase tracking-wide opacity-70">Transaction History</h3>

      <div className="space-y-3 pb-20">
        {transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No transactions yet.</p>
        ) : (
          transactions.map(t => (
            <PassbookTransactionItem key={t.id} transaction={t} onDelete={() => onDeleteTransaction(t)} />
          ))
        )}
      </div>

      {showSendMessage && (
        <SendMessageModal
          user={user}
          customer={liveCustomer}
          onClose={() => setShowSendMessage(false)}
        />
      )}
    </div>
  );
}

function PassbookTransactionItem({ transaction, onDelete }: { transaction: Transaction, onDelete: () => void }) {
  const longPressProps = useLongPress(onDelete, 1000);

  return (
    <div
      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-start select-none active:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex gap-3">
        <div className={`mt-1 p-2 rounded-lg ${transaction.type === 'SALE' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
          {transaction.type === 'SALE' ? <ShoppingBag size={18} /> : <IndianRupee size={18} />}
        </div>
        <div>
          <p className="font-bold text-gray-800">
            {transaction.type === 'SALE' ? 'Rice Sale' : 'Payment Received'}
          </p>
          {transaction.details?.brand && (
            <p className="text-xs text-gray-600 font-medium">
              {transaction.details.brand} • {transaction.details.bags} bags @ ₹{transaction.details.pricePerBag}
            </p>
          )}
          {transaction.details?.notes && (
            <p className="text-xs text-gray-500 italic mt-0.5">"{transaction.details.notes}"</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            {transaction.date?.toDate ? transaction.date.toDate().toLocaleDateString('en-IN') + ' ' + transaction.date.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className={`font-bold ${transaction.type === 'SALE' ? 'text-red-600' : 'text-emerald-600'}`}>
          {transaction.type === 'SALE' ? '+' : '-'} ₹{transaction.amount}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function TransactionForm({ type, user, customer, onSuccess, brands }: { type: 'SALE' | 'PAYMENT', user: User, customer: Customer, onSuccess: () => void, brands: string[] }) {
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
      await runTransaction(db, async (transaction) => {
        const timestamp = serverTimestamp();
        const txCol = collection(db, `users/${user.uid}/transactions`);
        const newTxRef = doc(txCol);

        // Inventory Ref (only check for SALE)
        let inventoryRef;
        let currentStock = 0;

        if (type === 'SALE') {
          inventoryRef = doc(db, `users/${user.uid}/inventory`, formData.brand);
          const invSnap = await transaction.get(inventoryRef);
          if (invSnap.exists()) {
            currentStock = invSnap.data().count || 0;
          }
        }

        // Calculations
        const amount = type === 'SALE' ? totalSaleAmount : formData.amount;
        let newBalance = customer.balance;

        if (type === 'SALE') {
          newBalance = customer.balance + totalSaleAmount - formData.paidNow;
        } else {
          newBalance = customer.balance - formData.amount;
        }

        // Writes
        // 1. Transaction
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
        transaction.set(newTxRef, mainTxData);

        // 2. Partial Payment
        if (type === 'SALE' && formData.paidNow > 0) {
          const partTxRef = doc(txCol);
          transaction.set(partTxRef, {
            customerId: customer.id,
            customerName: customer.name,
            type: 'PAYMENT',
            amount: formData.paidNow,
            date: timestamp,
            details: { notes: 'Partial payment for sale' }
          });
        }

        // 3. Customer Balance
        const customerRef = doc(db, `users/${user.uid}/customers`, customer.id);
        transaction.update(customerRef, { balance: newBalance });

        // 4. Inventory Update (explicit subtraction)
        if (type === 'SALE' && inventoryRef) {
          // Explicitly deducting count
          transaction.set(inventoryRef, {
            count: currentStock - formData.bags,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        }
      });

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

function AddCustomerForm({ user, onCancel, locations, initialData }: { user: User, onCancel: () => void, locations: string[], initialData?: Customer }) {
  const [step, setStep] = useState(initialData ? 2 : 1);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    location: (initialData?.location || '') as Location | ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location || !formData.name) return;

    setLoading(true);
    try {
      if (initialData) {
        // Update existing
        const customerRef = doc(db, `users/${user.uid}/customers`, initialData.id);
        await updateDoc(customerRef, {
          ...formData,
          // balance: is unchangeable here
        });
      } else {
        // Create new
        await addDoc(collection(db, `users/${user.uid}/customers`), {
          ...formData,
          balance: 0,
          createdAt: serverTimestamp()
        });
      }
      onCancel();
    } catch (err) {
      console.error("Error saving customer:", err);
      alert("Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800">
          {initialData ? 'Edit Customer' : (step === 1 ? 'Select Location' : 'Customer Details')}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3">
          {locations.map((loc) => (
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

function ReportsView({ user }: { user: User }) {
  const [generating, setGenerating] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    // Determine available locations dynamically from existing customers
    const q = query(collection(db, `users/${user.uid}/customers`));
    const unsub = onSnapshot(q, (snap) => {
      const locs = new Set<string>();
      snap.docs.forEach(d => {
        const val = d.data();
        if (val.location && val.location.trim() !== '') {
          locs.add(val.location.trim());
        }
      });
      const sortedLocs = Array.from(locs).sort();
      setLocations(sortedLocs);
      // Select all by default if no selection made yet (or maybe just keep empty implies all? No, explicit better for checkboxes)
      // Actually let's select all by default so the list isn't empty on load.
      // But only on first load.
      if (selectedLocations.length === 0 && sortedLocs.length > 0) {
        setSelectedLocations(sortedLocs);
      }
    });
    return () => unsub();
  }, [user.uid]); // Removed selectedLocations dependency to avoid infinite loop reset, handled logic inside


  const toggleLocation = (loc: string) => {
    if (selectedLocations.includes(loc)) {
      setSelectedLocations(selectedLocations.filter(l => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  };

  const toggleAll = () => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(locations);
    }
  };

  const downloadPDF = (title: string, headers: string[], data: any[], filename: string) => {
    const doc = new jsPDF();

    // 1. Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Generated on: ${dateStr}`, 14, 30);

    // Show selected locations summary if not all
    if (selectedLocations.length < locations.length && title.includes("Customer")) {
      const locText = selectedLocations.length > 5
        ? `Locations: ${selectedLocations.length} selected`
        : `Locations: ${selectedLocations.join(', ')}`;
      doc.text(locText, 14, 35);
    } else if (title.includes("Customer")) {
      doc.text("Locations: All", 14, 35);
    }

    // 2. Table
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: title.includes("Customer") ? 40 : 35,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Emerald color
      styles: { fontSize: 10, cellPadding: 3 },
      alternateRowStyles: { fillColor: [240, 253, 244] } // Light emerald
    });

    // 3. Save
    doc.save(filename);
  };

  const handleExportBalances = async () => {
    setGenerating(true);
    try {
      // Fetch ALL customers then filter client side. more efficient than multiple queries or complex 'in' queries for PDF gen.
      new Promise<any[]>((resolve, reject) => {
        const q = collection(db, `users/${user.uid}/customers`);
        const unsub = onSnapshot(q, (snap) => {
          const querySnap = snap as QuerySnapshot<DocumentData>;

          let filteredDocs = querySnap.docs;
          if (selectedLocations.length < locations.length) {
            filteredDocs = querySnap.docs.filter(d => {
              const loc = d.data().location || '';
              return selectedLocations.includes(loc.trim());
            });
          }

          const data = filteredDocs.map(d => {
            const val = d.data();
            return [val.name, val.phone, val.location || '', val.balance];
          });
          resolve(data);
          unsub();
        }, reject);
      }).then(data => {
        const headers = ["Name", "Phone", "Location", "Balance"];
        const title = selectedLocations.length === locations.length ? "Customer Balances (All)" : "Customer Balances (Filtered)";
        downloadPDF(title, headers, data, "customer_balances.pdf");
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
          const querySnap = snap as QuerySnapshot<DocumentData>;
          const data = querySnap.docs.map(d => {
            const val = d.data();
            const dateStr = val.date?.toDate ? val.date.toDate().toLocaleDateString('en-IN') : '';
            const amount = val.amount;
            const type = val.type === 'SALE' ? 'Sale' : 'Payment';
            const details = val.type === 'SALE'
              ? `${val.details.brand} (${val.details.bags} bags)`
              : (val.details.notes || '-');
            return [dateStr, val.customerName, type, details, amount];
          });
          resolve(data);
          unsub();
        }, reject);
      }).then(data => {
        const headers = ["Date", "Customer", "Type", "Details", "Amount"];
        downloadPDF("Transaction History Report", headers, data, "transactions.pdf");
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-gray-800">Customer Balances</h3>
              <p className="text-sm text-gray-500">List of all customer dues (PDF).</p>
            </div>
            <button
              onClick={handleExportBalances}
              disabled={generating || selectedLocations.length === 0}
              className={`p-3 rounded-xl transition-colors flex items-center gap-2 ${generating || selectedLocations.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
            >
              <FileText size={20} /> <span className="text-xs font-bold">PDF</span>
            </button>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Filter Locations</label>
              <button onClick={toggleAll} className="text-xs text-emerald-600 font-semibold hover:underline">
                {selectedLocations.length === locations.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {locations.length === 0 && <span className="text-xs text-gray-400 italic">No locations found.</span>}
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => toggleLocation(loc)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedLocations.includes(loc)
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-200'
                    }`}
                >
                  {selectedLocations.includes(loc) && <span className="mr-1">✓</span>}
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800">Transaction History</h3>
            <p className="text-sm text-gray-500">Full log of sales & payments (PDF).</p>
          </div>
          <button
            onClick={handleExportTransactions}
            disabled={generating}
            className="bg-blue-100 text-blue-700 p-3 rounded-xl hover:bg-blue-200 transition-colors flex items-center gap-2"
          >
            <FileText size={20} /> <span className="text-xs font-bold">PDF</span>
          </button>
        </div>
      </div>

      {generating && <p className="text-center text-gray-400 mt-4 text-sm animate-pulse">Generating PDF...</p>}
    </div>
  );
}



function BrandManager({ user, onClose }: { user: User, onClose: () => void }) {
  const [brands, setBrands] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists() && docSnap.data().brands) {
        setBrands(docSnap.data().brands);
      } else {
        setBrands(['Sona Masoori', 'Basmati', 'Ponni Rice', 'Idly Rice']);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    try {
      const brandRef = doc(db, `users/${user.uid}/settings/general`);
      await setDoc(brandRef, {
        brands: arrayUnion(newBrand.trim())
      }, { merge: true });
      setNewBrand('');
    } catch (error) {
      console.error("Error adding brand:", error);
      alert("Failed to add brand");
    }
  };

  const removeBrand = async (brand: string) => {
    if (!confirm(`Delete ${brand}?`)) return;
    try {
      const brandRef = doc(db, `users/${user.uid}/settings/general`);
      await updateDoc(brandRef, {
        brands: arrayRemove(brand)
      });
    } catch (error) {
      console.error("Error removing brand:", error);
      alert("Failed to remove brand");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Manage Rice Brands</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Enter brand name..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addBrand()}
            />
            <button
              onClick={addBrand}
              disabled={!newBrand.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <p className="text-center text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              {brands.map((b, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="font-medium text-gray-700">{b}</span>
                  <button
                    onClick={() => removeBrand(b)}
                    className="text-red-400 hover:text-red-600 p-1 font-bold text-xs uppercase"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {brands.length === 0 && <p className="text-center text-gray-400">No brands added yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationManager({ user, onClose }: { user: User, onClose: () => void }) {
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists() && docSnap.data().locations) {
        setLocations(docSnap.data().locations);
      } else {
        setLocations(['Mothepalayam', 'Mettupalayam', 'Sirumugai', 'Karamadai', 'Alangombu', 'Sankar Nagar']);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const addLocation = async () => {
    if (!newLocation.trim()) return;
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/general`);
      await setDoc(settingsRef, {
        locations: arrayUnion(newLocation.trim())
      }, { merge: true });
      setNewLocation('');
    } catch (error) {
      console.error("Error adding location:", error);
      alert("Failed to add location");
    }
  };

  const removeLocation = async (loc: string) => {
    if (!confirm(`Delete ${loc}?`)) return;
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/general`);
      await updateDoc(settingsRef, {
        locations: arrayRemove(loc)
      });
    } catch (error) {
      console.error("Error removing location:", error);
      alert("Failed to remove location");
    }
  };

  const startEditing = (loc: string) => {
    setEditingLoc(loc);
    setEditValue(loc);
  };

  const saveEdit = async () => {
    if (!editingLoc || !editValue.trim() || editValue === editingLoc) {
      setEditingLoc(null);
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Update Settings
      const settingsRef = doc(db, `users/${user.uid}/settings/general`);
      const newLocations = locations.map(l => l === editingLoc ? editValue.trim() : l);
      batch.update(settingsRef, { locations: newLocations });

      // 2. Update all Customers with this location
      // Note: This might be expensive if there are huge number of customers, 
      // but for this app scale (thousands) it's likely okay or we should do it via cloud function.
      // Doing it client side for now.
      const q = query(
        collection(db, `users/${user.uid}/customers`),
        where('location', '==', editingLoc)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { location: editValue.trim() });
      });

      await batch.commit();
      setEditingLoc(null);
    } catch (error) {
      console.error("Error updating location:", error);
      alert("Failed to update location");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Manage Locations</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Enter location name..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addLocation()}
            />
            <button
              onClick={addLocation}
              disabled={!newLocation.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <p className="text-center text-gray-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              {locations.map((loc, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  {editingLoc === loc ? (
                    <div className="flex gap-2 flex-1 mr-2">
                      <input
                        className="flex-1 border border-emerald-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={saveEdit} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded">
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-700">{loc}</span>
                  )}

                  <div className="flex gap-1">
                    {editingLoc !== loc && (
                      <button
                        onClick={() => startEditing(loc)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => removeLocation(loc)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {locations.length === 0 && <p className="text-center text-gray-400">No locations added yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageManager({ user, onClose }: { user: User, onClose: () => void }) {
  const [shopSettings, setShopSettings] = useState<ShopSettings>({ shopName: '', ownerName: '', mobile: '' });
  // const [loading, setLoading] = useState(true); // Unused

  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shopSettings) setShopSettings(data.shopSettings);
        // Merge saved templates with defaults
        if (data.messageTemplates) {
          const saved = data.messageTemplates as MessageTemplate[];
          setTemplates(() => DEFAULT_TEMPLATES.map(def => saved.find(s => s.name === def.name) || def));
        }
      }
      // setLoading(false); // setLoading unused


    });
    return () => unsub();
  }, [user.uid]);

  const saveSettings = async () => {
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/general`);
      await setDoc(settingsRef, {
        shopSettings: shopSettings
      }, { merge: true });
      setIsEditingProfile(false);
      // alert("Profile saved!"); // Removed alert for smoother UX
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/general`);

      // Update logic: Replace the template in the array if it exists
      const updatedTemplates = templates.map(t => t.name === editingTemplate.name ? editingTemplate : t);

      await setDoc(settingsRef, {
        messageTemplates: updatedTemplates
      }, { merge: true });

      setEditingTemplate(null);
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Message Manager</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {editingTemplate ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setEditingTemplate(null)} className="text-gray-500 hover:text-gray-700">
                  <LogOut size={16} className="rotate-180" />
                </button>
                <h4 className="font-bold text-gray-800">Edit {editingTemplate.name} Template</h4>
              </div>

              <textarea
                value={editingTemplate.content}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                className="w-full h-64 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />

              <div className="flex gap-2">
                <button
                  onClick={saveTemplate}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-sm hover:bg-emerald-700"
                >
                  Save Template
                </button>
                <button
                  onClick={() => {
                    const def = DEFAULT_TEMPLATES.find(t => t.name === editingTemplate.name);
                    if (def) setEditingTemplate({ ...editingTemplate, content: def.content });
                  }}
                  className="px-4 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl border border-gray-200"
                  title="Reset to Default"
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 bg-emerald-50">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-emerald-800 text-sm">Shop Profile (for placeholders)</h4>
                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-1 rounded-lg font-bold hover:bg-emerald-50"
                    >
                      Modify
                    </button>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <input
                      placeholder="Shop Name"
                      value={shopSettings.shopName}
                      onChange={e => setShopSettings({ ...shopSettings, shopName: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <input
                      placeholder="Owner Name"
                      value={shopSettings.ownerName}
                      onChange={e => setShopSettings({ ...shopSettings, ownerName: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <input
                      placeholder="Contact Mobile"
                      value={shopSettings.mobile}
                      onChange={e => setShopSettings({ ...shopSettings, mobile: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        className="flex-1 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveSettings}
                        className="flex-1 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-700 shadow-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 pl-1">
                    <p className="text-sm font-bold text-gray-800">{shopSettings.shopName || <span className="text-gray-400 italic font-normal">No Shop Name</span>}</p>
                    <p className="text-xs text-gray-600">{shopSettings.ownerName || <span className="text-gray-400 italic">No Owner Name</span>}</p>
                    <p className="text-xs text-gray-600">{shopSettings.mobile || <span className="text-gray-400 italic">No Mobile</span>}</p>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3">
                <h4 className="font-bold text-gray-800 text-sm">Default Templates</h4>
                {templates.map((t, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center group">
                    <div>
                      <span className="font-bold text-gray-700 text-sm">{t.name}</span>
                    </div>
                    <button
                      onClick={() => setEditingTemplate(t)}
                      className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                    >
                      Modify
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-400 text-center mt-2">
                  Click "Modify" to customize the default templates.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    name: 'Tamil',
    content: `வணக்கம் [வாடிக்கையாளர் பெயர்],

[கடை பெயர்]-யில் உங்களுடைய தற்போதைய நிலுவைத் தொகை [தொகை]. இத்தொகையை விரைவில் செலுத்துமாறு கேட்டுக்கொள்கிறோம்.

நன்றி. 
[உரிமையாளர் பெயர்] 
[உரிமையாளர் அலைபேசி எண்]`
  },
  {
    name: 'English',
    content: `Dear [Customer Name], 

Your current pending balance at [shop name] is [Pending amount]. Please pay at your earliest convenience. Thank you.

Regards, 
[Owner's Name]
[Owner's Mobile Number]`
  }
];

function SendMessageModal({ user, customer, onClose }: { user: User, customer: Customer, onClose: () => void }) {
  const [shopSettings, setShopSettings] = useState<ShopSettings>({ shopName: '', ownerName: '', mobile: '' });
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [previewText, setPreviewText] = useState('');


  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shopSettings) setShopSettings(data.shopSettings);
        if (data.messageTemplates) {
          const saved = data.messageTemplates as MessageTemplate[];
          setTemplates(() => DEFAULT_TEMPLATES.map(def => saved.find(s => s.name === def.name) || def));
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    if (selectedTemplate) {
      let text = selectedTemplate.content;
      text = text.replace(/\[Customer Name\]/gi, customer.name);
      text = text.replace(/\[Amount\]/gi, formatCurrency(Math.abs(customer.balance)));
      text = text.replace(/\[Pending amount\]/gi, formatCurrency(Math.abs(customer.balance)));
      text = text.replace(/\[shop name\]/gi, shopSettings.shopName || '[Shop Name]');
      text = text.replace(/\[owner's name\]/gi, shopSettings.ownerName || '[Owner Name]');
      text = text.replace(/\[owner name\]/gi, shopSettings.ownerName || '[Owner Name]');
      text = text.replace(/\[Owner's Mobile NUmber\]/gi, shopSettings.mobile || '[Mobile]');
      text = text.replace(/\[Owner's Mobile Number\]/gi, shopSettings.mobile || '[Mobile]');

      // Tamil Placeholders
      text = text.replace(/\[வாடிக்கையாளர் பெயர்\]/gi, customer.name);
      text = text.replace(/\[தொகை\]/gi, formatCurrency(Math.abs(customer.balance)));
      text = text.replace(/\[கடை பெயர்\]/gi, shopSettings.shopName || '[Shop Name]');
      text = text.replace(/\[உரிமையாளர் பெயர்\]/gi, shopSettings.ownerName || '[Owner Name]');
      text = text.replace(/\[உரிமையாளர் அலைபேசி எண்\]/gi, shopSettings.mobile || '[Mobile]');
      setPreviewText(text);
    } else {
      setPreviewText('');
    }
  }, [selectedTemplate, customer, shopSettings]);

  const sendSMS = () => {
    if (!previewText) return;
    window.location.href = `sms:${customer.phone}?body=${encodeURIComponent(previewText)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Send Message to {customer.name}</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-gray-400 text-center">Loading settings...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Language</label>
                <div className="space-y-2">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedTemplate(t)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedTemplate?.name === t.name
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                        : 'border-gray-200 hover:bg-gray-50 bg-white'
                        }`}
                    >
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-1 mt-1 whitespace-pre-line">{t.content.substring(0, 50)}...</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Preview</label>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200">
                    {previewText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={sendSMS}
            disabled={!selectedTemplate}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            <Send size={20} />
            Send via SMS
          </button>
        </div>
      </div>
    </div>
  );

}


function InventoryView({ user }: { user: User }) {
  const [items, setItems] = useState<{ id: string, count: number, lastUpdated: any }[]>([]);
  const [showAddStock, setShowAddStock] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Brands
  useEffect(() => {
    const unsub = onSnapshot(doc(db, `users/${user.uid}/settings/general`), (docSnap) => {
      if (docSnap.exists() && docSnap.data().brands) {
        setBrands(docSnap.data().brands);
      } else {
        setBrands(['Sona Masoori', 'Basmati', 'Ponni Rice', 'Idly Rice']);
      }
    });
    return () => unsub();
  }, [user.uid]);

  // Fetch Inventory
  useEffect(() => {
    const q = collection(db, `users/${user.uid}/inventory`);
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  if (viewingHistoryFor) {
    return <BrandHistory user={user} brand={viewingHistoryFor} onBack={() => setViewingHistoryFor(null)} />;
  }

  return (
    <div className="pb-24">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Stock Available</h2>
          <p className="text-sm text-gray-500">Manage your rice bag stacks</p>
        </div>
        <button
          onClick={() => setShowAddStock(true)}
          className="bg-emerald-600 text-white p-3 rounded-xl shadow-sm hover:bg-emerald-700 flex items-center gap-2"
        >
          <Plus size={20} />
          <span className="font-bold text-sm">Update Stock</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-gray-400 text-center col-span-2">Loading inventory...</p>
        ) : items.length === 0 ? (
          <div className="col-span-2 text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Layers size={48} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">No stock records yet.</p>
            <button
              onClick={() => setShowAddStock(true)}
              className="mt-2 text-emerald-600 font-bold text-sm hover:underline"
            >
              Add initial stock
            </button>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              onClick={() => setViewingHistoryFor(item.id)}
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow active:bg-gray-50"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-lg">{item.id}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem(item.id);
                      setShowAddStock(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Last updated: {item.lastUpdated?.toDate ? item.lastUpdated.toDate().toLocaleDateString() : 'Just now'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Available</p>
                <div className={`text-3xl font-black ${item.count < 10 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {item.count} <span className="text-sm font-medium text-gray-400">bags</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddStock && (
        <AddStockModal
          user={user}
          brands={brands}
          currentItems={items}
          onClose={() => {
            setShowAddStock(false);
            setEditingItem(null);
          }}
          initialBrand={editingItem}
          initialAction={editingItem ? 'SET' : 'ADD'}
        />
      )}
    </div>
  );
}

function BrandHistory({ user, brand, onBack }: { user: User, brand: string, onBack: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      where('type', '==', 'SALE'),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      const brandTx = data.filter(t => t.details?.brand === brand);
      setTransactions(brandTx);
      setLoading(false);
    });

    return () => unsub();
  }, [user.uid, brand]);

  return (
    <div className="pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{brand} History</h2>
          <p className="text-sm text-gray-500">Sales record</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading history...</p>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">No sales found for this brand.</p>
          </div>
        ) : (
          transactions.map(t => (
            <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-800">{t.customerName}</p>
                <div className="text-xs text-gray-500 mt-1">
                  {t.date?.toDate ? (
                    <>
                      <div className="flex gap-4 mb-1">
                        <span><span className="font-semibold text-gray-600">Date:</span> {format(t.date.toDate(), 'dd/MM/yyyy')}</span>
                        <span><span className="font-semibold text-gray-600">Time:</span> {format(t.date.toDate(), 'hh:mm a')}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Info:</span> {t.details?.bags} bags @ ₹{t.details?.pricePerBag}
                      </div>
                    </>
                  ) : ''}
                </div>
              </div>
              <p className="font-bold text-emerald-600">+ ₹{t.amount}</p>
            </div>
          ))
        )}
      </div>
    </div >
  );
}

function AddStockModal({ user, brands, onClose, currentItems, initialBrand, initialAction }: { user: User, brands: string[], onClose: () => void, currentItems: any[], initialBrand?: string | null, initialAction?: 'ADD' | 'SET' }) {
  const [selectedBrand, setSelectedBrand] = useState(initialBrand || brands[0] || '');
  const [action, setAction] = useState<'ADD' | 'SET'>(initialAction || 'ADD');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  // Ensure the valid options include the initialBrand even if not in the global list (e.g. deleted but has stock)
  const effectiveBrands = useMemo(() => {
    if (initialBrand && !brands.includes(initialBrand)) {
      return [initialBrand, ...brands];
    }
    return brands;
  }, [brands, initialBrand]);

  const currentCount = currentItems.find(i => i.id === selectedBrand)?.count || 0;

  const handleUpdate = async () => {
    if (!selectedBrand || quantity === '' || quantity < 0) return;
    setLoading(true);

    try {
      const ref = doc(db, `users/${user.uid}/inventory`, selectedBrand);
      let newCount = 0;

      if (action === 'SET') {
        newCount = Number(quantity);
      } else {
        newCount = currentCount + Number(quantity);
      }

      await setDoc(ref, {
        count: newCount,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Update Stock</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Rice Brand</label>
            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {effectiveBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl flex justify-between items-center">
            <span className="text-emerald-800 font-medium">Current Stock:</span>
            <span className="text-2xl font-bold text-emerald-700">{currentCount} bags</span>
          </div>

          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setAction('ADD')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${action === 'ADD' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Add Stock (+)
            </button>
            <button
              onClick={() => setAction('SET')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${action === 'SET' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Set Total (=)
            </button>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {action === 'ADD' ? 'Quantity to Add' : 'New Total Quantity'}
            </label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full p-4 text-center text-2xl font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0"
              autoFocus
            />
          </div>

          <button
            onClick={handleUpdate}
            disabled={loading || quantity === ''}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 mt-2"
          >
            {loading ? 'Updating...' : 'Confirm Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
