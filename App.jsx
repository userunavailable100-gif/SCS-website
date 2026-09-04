import React, { useState, useEffect, useCallback } from "react";
import {
  Star, User, ShoppingCart, LogOut, Copy, Users, Wallet,
  TrendingUp, Package, Shield, Plus, Trash2, Check, X,
  ChevronRight, ArrowDownCircle, ShieldCheck, Truck, Award,
  Eye, EyeOff, Minus, Clock, Loader, XCircle, CheckCircle2,
  MoreVertical, Share2, Home as HomeIcon, LayoutDashboard
} from "lucide-react";
import { subscribeProducts, subscribeUsers, subscribeOrders, subscribeWithdrawals, addProductDoc, updateProductDoc, deleteProductDoc, addUserDoc, updateUserDoc, creditUserWallet, addOrderDoc, updateOrderDoc, addWithdrawalDoc, updateWithdrawalDoc, getNextMemberId } from "./firebase";

const ADMIN_USERNAME = "scs_owner_26";
const ADMIN_PASS = "Scs#Vault!9247Qx";
const GROUP_SIZE = 10;
const WITHDRAW_MIN_POINTS = 100;

const seedProducts = [
  { id: "p1", name: "Glass Skin Rice Serum", category: "Skincare", image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400", consultantPrice: 1800, customerPrice: 2400, points: 3, stock: 40 },
  { id: "p2", name: "Anti-Melasma Gel", category: "Skincare", image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400", consultantPrice: 1450, customerPrice: 1950, points: 3, stock: 35 },
  { id: "p3", name: "Charcoal Detox Mask", category: "Skincare", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400", consultantPrice: 900, customerPrice: 1200, points: 2, stock: 60 },
  { id: "p4", name: "Silk Hair Fall Oil", category: "Haircare", image: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbd?w=400", consultantPrice: 1100, customerPrice: 1500, points: 2, stock: 50 },
  { id: "p5", name: "Keratin Shine Shampoo", category: "Haircare", image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400", consultantPrice: 1050, customerPrice: 1400, points: 2, stock: 45 },
];

const couriers = ["Leopards Courier", "TCS", "M&P", "PostEx", "Trax"];

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function fmt(n) {
  return `Rs ${Number(n || 0).toLocaleString("en-PK")}`;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function readAndResizeImage(file, maxWidth = 600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const Logo = ({ size = 30 }) => (
  <div className="flex items-center gap-2">
    <div
      className="flex items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#7A1F3D,#A6335C)" }}
    >
      <span style={{ color: "#F4D9A0", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: size * 0.55 }}>S</span>
    </div>
    <span className="text-xl tracking-tight font-bold" style={{ color: "#1A1220", fontFamily: "'Playfair Display', serif" }}>
      SCS
    </span>
  </div>
);

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-sm"
      style={{ background: "#1A1220", color: "#fff" }}
    >
      {message}
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadedFlags, setLoadedFlags] = useState({ products: false, users: false, orders: false, withdrawals: false });
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("verify");
  const [verified, setVerified] = useState(false);
  const [cart, setCart] = useState({});
  const [toast, setToast] = useState("");
  const [refFromUrl, setRefFromUrl] = useState("");
  const [justCreated, setJustCreated] = useState(null); // {id, email, password}
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [revealSCS, setRevealSCS] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loading = !(loadedFlags.products && loadedFlags.users && loadedFlags.orders && loadedFlags.withdrawals);
  // This combined object is rebuilt every render from the four live-synced
  // collections above, so every screen below still reads state.products /
  // state.users / etc exactly as before — only how the data gets here changed.
  const state = { users, products, orders, withdrawals };

  const notify = (msg) => setToast(msg);

  // Push each view change into browser history so the phone/browser back button
  // steps back through the app instead of leaving it.
  const navigate = (v) => {
    setView(v);
    setMenuOpen(false);
    try {
      window.history.pushState({ scsView: v }, "", `#${v}`);
    } catch (e) {}
  };

  useEffect(() => {
    const onPop = (e) => {
      const v = e.state && e.state.scsView ? e.state.scsView : "home";
      setView(v);
    };
    try {
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    } catch (e) {}
  }, []);

  const shareLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied — paste it anywhere to share.");
    } catch (e) {
      notify("Copy not supported on this browser.");
    }
    setMenuOpen(false);
  };

  const loadState = useCallback(() => {
    let seeded = false;
    const unsubs = [
      subscribeProducts(async (rows) => {
        setProducts(rows);
        setLoadedFlags((f) => ({ ...f, products: true }));
        if (!seeded && rows.length === 0) {
          seeded = true;
          try {
            for (const p of seedProducts) await addProductDoc(p);
          } catch (e) {
            console.error("Seeding failed", e);
          }
        }
      }),
      subscribeUsers((rows) => {
        setUsers(rows);
        setLoadedFlags((f) => ({ ...f, users: true }));
      }),
      subscribeOrders((rows) => {
        setOrders(rows.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setLoadedFlags((f) => ({ ...f, orders: true }));
      }),
      subscribeWithdrawals((rows) => {
        setWithdrawals(rows.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setLoadedFlags((f) => ({ ...f, withdrawals: true }));
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  useEffect(() => {
    const unsubscribe = loadState();
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) setRefFromUrl(ref);
    } catch (e) {}
    (async () => {
      try {
        const saved = localStorage.getItem("scs-session");
        if (saved) {
          setCurrentUser(saved);
          setVerified(true);
        }
      } catch (e) {}
    })();
    return unsubscribe;
  }, [loadState]);

  useEffect(() => {
    if (loading || !currentUser) return;
    if (currentUser === "__admin__") {
      setIsAdmin(true);
      setView("admin");
    } else if (users.find((u) => u.username === currentUser)) {
      setView("dashboard");
    }
  }, [currentUser, loading]);

  const me = currentUser && currentUser !== "__admin__"
    ? users.find((u) => u.username === currentUser)
    : null;

  const handleVerify = () => {
    setVerified(true);
    setView("home");
  };

  const handleRegister = async (form) => {
    const { name, phone, cnic, email, username, password, sponsor } = form;
    if (!name || !phone || !cnic || !email || !username || !password) return notify("Please fill in all required fields.");

    // Pakistani mobile number: 03XXXXXXXXX (11 digits) or +923XXXXXXXXX
    const phoneDigits = phone.replace(/[^\d]/g, "");
    const validPhone =
      (phoneDigits.length === 11 && phoneDigits.startsWith("03")) ||
      (phoneDigits.length === 12 && phoneDigits.startsWith("923"));
    if (!validPhone) return notify("Enter a valid Pakistani number, e.g. 03XXXXXXXXX.");

    // CNIC: 13 digits (with or without dashes)
    const cnicDigits = cnic.replace(/[^\d]/g, "");
    if (cnicDigits.length !== 13) return notify("Enter a valid 13-digit CNIC number, e.g. 12345-1234567-1.");

    // Password: at least 6 characters, must contain both letters and numbers
    const validPassword = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%^&*!_-]{6,}$/.test(password);
    if (!validPassword) return notify("Password must be at least 6 characters and include both letters and numbers.");

    if (users.some((u) => u.username === username)) return notify("This username is already taken.");
    if (users.some((u) => u.phone === phone)) return notify("This phone number is already registered.");
    const sponsorUser = sponsor ? users.find((u) => u.memberId === sponsor.toUpperCase()) : null;
    try {
      const memberId = await getNextMemberId();
      const newUser = {
        id: memberId,
        memberId,
        name, phone, cnic, email, username, password,
        sponsorId: sponsorUser ? sponsorUser.memberId : null,
        walletBalance: 0,
        points: 0,
        joinedAt: new Date().toISOString(),
      };
      await addUserDoc(newUser);
      setJustCreated({ id: memberId, email, password, username });
      setView("account-created");
    } catch (e) {
      console.error(e);
      notify("Could not create your account — please check your connection and try again.");
    }
  };

  const finishOnboarding = async () => {
    setShowDisclaimer(true);
  };

  const dismissDisclaimer = async () => {
    setShowDisclaimer(false);
    setRevealSCS(true);
    setTimeout(() => {
      setRevealSCS(false);
      try {
        localStorage.setItem("scs-session", justCreated ? justCreated.username : currentUser);
      } catch (e) {}
      if (justCreated) setCurrentUser(justCreated.username);
      setJustCreated(null);
      setView("dashboard");
    }, 1400);
  };

  const handleLogin = async ({ username, password }) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASS) {
      localStorage.setItem("scs-session", "__admin__");
      setCurrentUser("__admin__");
      notify("Signed in as admin.");
      return;
    }
    const u = users.find((x) => x.username === username && x.password === password);
    if (!u) return notify("Invalid username or password.");
    localStorage.setItem("scs-session", u.username);
    setCurrentUser(u.username);
    notify(`Welcome back, ${u.name.split(" ")[0]}!`);
  };

  const handleLogout = async () => {
    localStorage.removeItem("scs-session");
    setCurrentUser(null);
    setIsAdmin(false);
    setView("home");
    setCart({});
  };

  const updatePassword = async (newPassword) => {
    if (!me || !newPassword) return;
    try {
      await updateUserDoc(me.username, { password: newPassword });
      notify("Password updated.");
    } catch (e) {
      console.error(e);
      notify("Could not update password.");
    }
  };

  const addToCart = (id) => {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
    notify("Added to cart.");
  };
  const changeQty = (id, delta) => {
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });
  };
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find((x) => x.id === id);
    return s + (p ? p.customerPrice * qty : 0);
  }, 0);

  const placeOrder = async (form) => {
    if (!me) return notify("Please log in to place an order.");
    if (cartCount === 0) return;
    const items = Object.entries(cart).map(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      return { productId: id, name: p.name, customerPrice: p.customerPrice, consultantPrice: p.consultantPrice, points: p.points, qty };
    });
    const order = {
      id: genId("o"),
      userId: me.username,
      userName: me.name,
      memberId: me.memberId,
      items,
      total: cartTotal,
      status: "pending",
      courier: form.courier,
      address: { name: form.name, phone: form.phone, address: form.address, city: form.city, society: form.society },
      date: new Date().toISOString(),
      cashbackAwarded: null,
      pointsAwarded: null,
      creditGranted: false,
    };
    try {
      await addOrderDoc(order);
      for (const item of items) {
        const p = products.find((x) => x.id === item.productId);
        if (p) await updateProductDoc(p.id, { stock: Math.max(0, p.stock - item.qty) });
      }
      setCart({});
      notify("Order placed successfully.");
      setView("dashboard");
    } catch (e) {
      console.error(e);
      notify("Could not place order — please try again.");
    }
  };

  const adminUpdateOrderStatus = async (orderId, status, cashback, points) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    try {
      if (status === "delivered" && !order.creditGranted) {
        const cAmt = Number(cashback || 0);
        const pAmt = Number(points || 0);
        await updateOrderDoc(orderId, { status, cashbackAwarded: cAmt, pointsAwarded: pAmt, creditGranted: true });
        await creditUserWallet(order.userId, cAmt, pAmt);
        // Sponsor bonus: whoever referred this member also earns half the
        // points (rounded down) on every delivered order from their team.
        const buyer = users.find((u) => u.username === order.userId);
        if (buyer && buyer.sponsorId) {
          const sponsor = users.find((u) => u.memberId === buyer.sponsorId);
          const sponsorPoints = Math.floor(pAmt / 2);
          if (sponsor && sponsorPoints > 0) {
            await creditUserWallet(sponsor.username, 0, sponsorPoints);
          }
        }
      } else {
        await updateOrderDoc(orderId, { status });
      }
      notify("Order updated.");
    } catch (e) {
      console.error(e);
      notify("Could not update order.");
    }
  };

  const addProduct = async (p) => {
    const product = { id: genId("p"), name: p.name, category: p.category, image: p.image, consultantPrice: Number(p.consultantPrice), customerPrice: Number(p.customerPrice), points: Number(p.points), stock: Number(p.stock) };
    try {
      await addProductDoc(product);
      notify("Product added.");
    } catch (e) {
      console.error(e);
      notify("Could not add product.");
    }
  };
  const removeProduct = async (id) => {
    try {
      await deleteProductDoc(id);
      notify("Product removed.");
    } catch (e) {
      console.error(e);
      notify("Could not remove product.");
    }
  };

  const requestWithdrawal = async (form) => {
    if (!me) return;
    const amount = Number(form.amount);
    if (me.points < WITHDRAW_MIN_POINTS) return notify(`You need ${WITHDRAW_MIN_POINTS} points to withdraw.`);
    if (!amount || amount <= 0 || amount > me.walletBalance) return notify("Enter a valid amount within your wallet balance.");
    if (!form.accountTitle || !form.accountNumber || !form.bankName) return notify("Please fill in your account details.");
    const w = { id: genId("w"), userId: me.username, userName: me.name, memberId: me.memberId, amount, accountTitle: form.accountTitle, accountNumber: form.accountNumber, bankName: form.bankName, status: "pending", date: new Date().toISOString() };
    try {
      await addWithdrawalDoc(w);
      await creditUserWallet(me.username, -amount, 0);
      notify("Withdrawal request submitted.");
    } catch (e) {
      console.error(e);
      notify("Could not submit withdrawal request.");
    }
  };

  const resolveWithdrawal = async (id, action) => {
    const w = withdrawals.find((x) => x.id === id);
    if (!w || w.status !== "pending") return;
    try {
      await updateWithdrawalDoc(id, { status: action });
      if (action === "rejected") await creditUserWallet(w.userId, w.amount, 0);
      notify(`Withdrawal marked ${action}.`);
    } catch (e) {
      console.error(e);
      notify("Could not update withdrawal.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin" size={28} style={{ color: "#7A1F3D" }} />
          <span className="text-sm" style={{ color: "#8A8290" }}>Loading SCS…</span>
        </div>
      </div>
    );
  }

  if (!verified) {
    return <VerifyScreen onVerify={handleVerify} />;
  }

  const myOrders = me ? state.orders.filter((o) => o.userId === me.username) : [];
  const myPartners = me ? state.users.filter((u) => u.sponsorId === me.memberId) : [];
  const myGroups = Math.floor(myPartners.length / GROUP_SIZE);
  const myWithdrawals = me ? state.withdrawals.filter((w) => w.userId === me.username) : [];
  const referralLink = me && typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?ref=${me.memberId}` : "";

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .scs-card { background: #fff; border: 1px solid #ECE6EA; }
        .scs-btn { background: linear-gradient(135deg,#7A1F3D,#A6335C); color: #fff; font-weight: 600; }
        .scs-btn:hover { filter: brightness(1.06); }
        .scs-btn-outline { border: 1px solid #D8CDD3; color: #1A1220; background: #fff; }
        .scs-btn-outline:hover { border-color: #7A1F3D; color: #7A1F3D; }
        .scs-input { background: #FBF9FA; border: 1px solid #E3DCE0; color: #1A1220; }
        .scs-input:focus { outline: none; border-color: #7A1F3D; }
        .scs-muted { color: #8A8290; }
        .scs-gold { color: #B4842B; }
        .scs-maroon { color: #7A1F3D; }
        .scs-badge { background: #FBF3E9; }
      `}</style>

      <Toast message={toast} onClose={() => setToast("")} />

      {justCreated && view === "account-created" && (
        <AccountCreatedScreen data={justCreated} onContinue={finishOnboarding} />
      )}

      {showDisclaimer && <DisclaimerModal onClose={dismissDisclaimer} />}
      {revealSCS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "#1A1220" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", color: "#F4D9A0", fontSize: 64, fontWeight: 700, letterSpacing: 4 }} className="animate-pulse">
            SCS
          </span>
        </div>
      )}

      {view !== "account-created" && (
        <>
          <nav className="sticky top-0 z-40 bg-white" style={{ borderBottom: "1px solid #ECE6EA" }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
              <button onClick={() => navigate(me || isAdmin ? (isAdmin ? "admin" : "dashboard") : "home")}><Logo /></button>
              <div className="hidden md:flex items-center gap-6 text-sm scs-muted">
                <button onClick={() => navigate("home")} className="hover:scs-maroon" style={{ color: "#4A4450" }}>Products</button>
                {me && <button onClick={() => navigate("dashboard")} style={{ color: "#4A4450" }}>Dashboard</button>}
                {isAdmin && <button onClick={() => navigate("admin")} style={{ color: "#4A4450" }}>Admin</button>}
              </div>
              <div className="flex items-center gap-2 relative">
                <button onClick={() => notify("App download link will be added soon.")} className="scs-btn-outline p-2 rounded-lg" title="Download App">
                  <ArrowDownCircle size={18} />
                </button>
                {!isAdmin && (
                  <button onClick={() => navigate("cart")} className="relative scs-btn-outline p-2 rounded-lg">
                    <ShoppingCart size={18} />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 text-[10px] w-5 h-5 rounded-full flex items-center justify-center scs-btn">{cartCount}</span>
                    )}
                  </button>
                )}
                {!currentUser && (
                  <button onClick={() => navigate("login")} className="scs-btn-outline p-2 rounded-lg" title="Login">
                    <User size={18} />
                  </button>
                )}
                {!currentUser && (
                  <button onClick={() => navigate("register")} className="scs-btn px-4 py-2 rounded-lg text-sm">Join</button>
                )}
                {currentUser && (
                  <>
                    <button onClick={() => setMenuOpen((o) => !o)} className="scs-btn-outline p-2 rounded-lg" title="Menu">
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-11 w-48 bg-white rounded-lg shadow-lg z-50 py-1" style={{ border: "1px solid #ECE6EA" }}>
                        <button onClick={() => navigate("home")} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: "#1A1220" }}>
                          <HomeIcon size={14} /> Front page
                        </button>
                        <button onClick={() => navigate(isAdmin ? "admin" : "dashboard")} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: "#1A1220" }}>
                          <LayoutDashboard size={14} /> My dashboard
                        </button>
                        <button onClick={shareLink} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: "#1A1220" }}>
                          <Share2 size={14} /> Copy share link
                        </button>
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: "#C24444" }}>
                          <LogOut size={14} /> Logout
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </nav>

          <main className="max-w-6xl mx-auto px-5 py-10">
            {view === "home" && <Home state={state} addToCart={addToCart} setView={setView} me={me} />}
            {view === "login" && <AuthLogin onSubmit={handleLogin} switchView={() => setView("register")} />}
            {view === "register" && <AuthRegister onSubmit={handleRegister} switchView={() => setView("login")} defaultSponsor={refFromUrl} />}
            {view === "cart" && (
              <Cart state={state} cart={cart} changeQty={changeQty} total={cartTotal} me={me} goLogin={() => setView("login")} goCheckout={() => setView("checkout")} />
            )}
            {view === "checkout" && me && (
              <Checkout me={me} total={cartTotal} onSubmit={placeOrder} />
            )}
            {view === "dashboard" && me && (
              <Dashboard
                me={me}
                orders={myOrders}
                partners={myPartners}
                groups={myGroups}
                withdrawals={myWithdrawals}
                referralLink={referralLink}
                notify={notify}
                requestWithdrawal={requestWithdrawal}
                updatePassword={updatePassword}
              />
            )}
            {view === "admin" && isAdmin && (
              <Admin state={state} addProduct={addProduct} removeProduct={removeProduct} adminUpdateOrderStatus={adminUpdateOrderStatus} resolveWithdrawal={resolveWithdrawal} />
            )}
          </main>

          <footer className="border-t px-5 py-8 mt-16 text-center text-xs scs-muted" style={{ borderColor: "#ECE6EA" }}>
            SCS Member Portal — demo prototype. Order, wallet and points data are stored for this demo only.
          </footer>
        </>
      )}
    </div>
  );
}

function VerifyScreen({ onVerify }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <div className="flex justify-center mb-6"><Logo size={44} /></div>
        <div className="scs-card rounded-xl p-8" style={{ border: "1px solid #ECE6EA" }}>
          <ShieldCheck size={32} className="mx-auto mb-3 scs-maroon" />
          <h2 className="font-semibold text-lg mb-1" style={{ color: "#1A1220" }}>Verify you are not a robot</h2>
          <p className="text-sm scs-muted mb-6">Please confirm to continue to the SCS member portal.</p>
          <label className="flex items-center gap-3 scs-input rounded-lg px-4 py-3 mb-5 cursor-pointer justify-center">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span className="text-sm">I'm not a robot</span>
          </label>
          <button
            disabled={!checked}
            onClick={onVerify}
            className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountCreatedScreen({ data, onContinue }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">
        <CheckCircle2 size={44} className="mx-auto mb-4" style={{ color: "#2E9E6D" }} />
        <h2 className="font-semibold text-xl mb-1" style={{ color: "#1A1220" }}>Account created!</h2>
        <p className="text-sm scs-muted mb-6">Please take a screenshot of this screen for your records.</p>
        <div className="scs-card rounded-xl p-6 text-left space-y-3 mb-6">
          <div>
            <div className="text-xs scs-muted">Your Member ID</div>
            <div className="font-semibold scs-maroon">{data.id}</div>
          </div>
          <div>
            <div className="text-xs scs-muted">Email</div>
            <div className="font-medium" style={{ color: "#1A1220" }}>{data.email}</div>
          </div>
          <div>
            <div className="text-xs scs-muted">Password</div>
            <div className="font-medium" style={{ color: "#1A1220" }}>{data.password}</div>
          </div>
        </div>
        <button onClick={onContinue} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm">Continue</button>
      </div>
    </div>
  );
}

function DisclaimerModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: "rgba(26,18,32,0.6)" }}>
      <div className="bg-white rounded-xl p-6 max-w-sm w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4"><X size={18} style={{ color: "#8A8290" }} /></button>
        <ShieldCheck size={28} className="scs-maroon mb-3" />
        <p className="text-sm mb-3" style={{ color: "#1A1220" }}>
          SCS never asks members to pay any joining or hidden fee. All earnings come only from genuine product sales.
        </p>
        <p className="text-sm" style={{ color: "#1A1220", direction: "rtl" }}>
          ایس سی ایس کبھی بھی ممبرز سے کوئی جوائننگ فیس یا چھپی ہوئی رقم طلب نہیں کرتی۔ تمام آمدنی صرف حقیقی پراڈکٹ سیلز سے حاصل ہوتی ہے۔
        </p>
      </div>
    </div>
  );
}

function Home({ state, addToCart, setView, me }) {
  const [category, setCategory] = useState("All");
  const cats = ["All", "Skincare", "Haircare"];
  const filtered = category === "All" ? state.products : state.products.filter((p) => p.category === category);
  return (
    <div>
      <section className="grid md:grid-cols-2 gap-10 items-center mb-14">
        <div>
          <h1 className="text-4xl leading-tight mb-4 font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>
            Genuine beauty products.<br />Real member earnings.
          </h1>
          <p className="scs-muted mb-7 max-w-md">
            Shop skincare and haircare essentials, or become an SCS member to sell and earn from every delivered order.
          </p>
          {!me ? (
            <button onClick={() => setView("register")} className="scs-btn px-6 py-3 rounded-lg font-semibold flex items-center gap-2">
              Become a member <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={() => setView("dashboard")} className="scs-btn px-6 py-3 rounded-lg font-semibold flex items-center gap-2">
              Go to dashboard <ChevronRight size={16} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TrustBadge icon={ShieldCheck} label="100% Genuine" />
          <TrustBadge icon={Truck} label="Delivery All Over Pakistan" />
          <TrustBadge icon={Award} label="Trusted Members" />
        </div>
      </section>

      <div className="flex gap-2 mb-6">
        {cats.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-4 py-1.5 rounded-full text-sm ${category === c ? "scs-btn" : "scs-btn-outline"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((p) => (
          <div key={p.id} className="scs-card rounded-xl overflow-hidden flex flex-col">
            <div className="h-40 bg-gray-100 overflow-hidden">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.target.style.display = "none")} />
            </div>
            <div className="p-4 flex flex-col flex-1">
              <span className="text-xs scs-badge scs-maroon inline-block px-2 py-0.5 rounded-full w-fit mb-2">{p.category}</span>
              <h3 className="font-semibold mb-1 text-sm" style={{ color: "#1A1220" }}>{p.name}</h3>
              <div className="flex items-center justify-between mb-3 mt-auto">
                <span className="scs-maroon font-bold">{fmt(p.customerPrice)}</span>
                <span className="text-xs scs-muted">{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</span>
              </div>
              <button disabled={p.stock === 0} onClick={() => addToCart(p.id)} className="scs-btn-outline rounded-lg py-2 text-sm disabled:opacity-40">
                Add to cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustBadge({ icon: Icon, label }) {
  return (
    <div className="scs-card rounded-xl p-4 flex flex-col items-center text-center gap-2">
      <Icon size={22} className="scs-maroon" />
      <span className="text-xs font-medium" style={{ color: "#1A1220" }}>{label}</span>
    </div>
  );
}

function AuthRegister({ onSubmit, switchView, defaultSponsor }) {
  const [form, setForm] = useState({ name: "", phone: "", cnic: "", email: "", username: "", password: "", sponsor: defaultSponsor || "" });
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="max-w-sm mx-auto scs-card rounded-xl p-8">
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Join SCS</h2>
      <p className="scs-muted text-sm mb-6">Create your member account.</p>
      <div className="space-y-3">
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Full name" value={form.name} onChange={set("name")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Phone number (e.g. 03XXXXXXXXX)" value={form.phone} onChange={set("phone")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="CNIC number (e.g. 12345-1234567-1)" value={form.cnic} onChange={set("cnic")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Email address" value={form.email} onChange={set("email")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Choose a username" value={form.username} onChange={set("username")} />
        <div className="relative">
          <input type={showPw ? "text" : "password"} className="scs-input rounded-lg px-3 py-2.5 w-full text-sm pr-10" placeholder="Password (letters + numbers, min 6)" value={form.password} onChange={set("password")} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5">
            {showPw ? <EyeOff size={16} className="scs-muted" /> : <Eye size={16} className="scs-muted" />}
          </button>
        </div>
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Sponsor ID (optional)" value={form.sponsor} onChange={set("sponsor")} />
        <button onClick={() => onSubmit(form)} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm mt-2">Create account</button>
      </div>
      <p className="text-xs scs-muted mt-5 text-center">
        Already a member? <button onClick={switchView} className="scs-maroon underline">Log in</button>
      </p>
    </div>
  );
}

function AuthLogin({ onSubmit, switchView }) {
  const [form, setForm] = useState({ username: "", password: "" });
  return (
    <div className="max-w-sm mx-auto scs-card rounded-xl p-8">
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Welcome back</h2>
      <p className="scs-muted text-sm mb-6">Log in to your SCS account.</p>
      <div className="space-y-3">
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input type="password" className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button onClick={() => onSubmit(form)} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm mt-2">Log in</button>
      </div>
      <p className="text-xs scs-muted mt-5 text-center">
        New here? <button onClick={switchView} className="scs-maroon underline">Create an account</button>
      </p>
      <p className="text-xs scs-muted mt-3 text-center">Admin login is separate — use your assigned admin credentials.</p>
    </div>
  );
}

function Cart({ state, cart, changeQty, total, me, goLogin, goCheckout }) {
  const items = Object.entries(cart);
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Your cart</h2>
      {items.length === 0 && <p className="scs-muted text-sm">Your cart is empty.</p>}
      <div className="space-y-3 mb-6">
        {items.map(([id, qty]) => {
          const p = state.products.find((x) => x.id === id);
          if (!p) return null;
          return (
            <div key={id} className="scs-card rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={p.image} className="w-12 h-12 rounded object-cover bg-gray-100" onError={(e) => (e.target.style.display = "none")} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "#1A1220" }}>{p.name}</div>
                  <div className="text-xs scs-muted">{fmt(p.customerPrice)} each</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => changeQty(id, -1)} className="scs-btn-outline w-7 h-7 rounded flex items-center justify-center"><Minus size={12} /></button>
                <span className="text-sm w-4 text-center">{qty}</span>
                <button onClick={() => changeQty(id, 1)} className="scs-btn-outline w-7 h-7 rounded flex items-center justify-center"><Plus size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {items.length > 0 && (
        <div className="scs-card rounded-lg p-5">
          <div className="flex justify-between mb-4 text-sm">
            <span className="scs-muted">Total</span>
            <span className="scs-maroon font-bold text-lg">{fmt(total)}</span>
          </div>
          {me ? (
            <button onClick={goCheckout} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm">Proceed to checkout</button>
          ) : (
            <button onClick={goLogin} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm">Log in to checkout</button>
          )}
        </div>
      )}
    </div>
  );
}

function Checkout({ me, total, onSubmit }) {
  const [form, setForm] = useState({ name: me.name, phone: me.phone, address: "", city: "", society: "", courier: couriers[0] });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="max-w-md mx-auto scs-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-5" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Delivery details</h2>
      <div className="space-y-3">
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Full name" value={form.name} onChange={set("name")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Phone number" value={form.phone} onChange={set("phone")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="City" value={form.city} onChange={set("city")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Society / Area" value={form.society} onChange={set("society")} />
        <input className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" placeholder="Full address" value={form.address} onChange={set("address")} />
        <select className="scs-input rounded-lg px-3 py-2.5 w-full text-sm" value={form.courier} onChange={set("courier")}>
          {couriers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex justify-between text-sm py-2">
          <span className="scs-muted">Order total</span>
          <span className="scs-maroon font-bold">{fmt(total)}</span>
        </div>
        <button onClick={() => onSubmit(form)} className="scs-btn rounded-lg py-2.5 w-full font-semibold text-sm">Confirm order</button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="scs-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2 scs-muted text-xs"><Icon size={14} className="scs-maroon" /> {label}</div>
      <div className="text-2xl font-bold" style={{ color: "#1A1220", fontFamily: "'Playfair Display', serif" }}>{value}</div>
    </div>
  );
}

const statusMeta = {
  pending: { label: "Pending", color: "#B4842B", icon: Clock },
  "in-process": { label: "In Process", color: "#3F7DB8", icon: Loader },
  delivered: { label: "Delivered", color: "#2E9E6D", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "#C24444", icon: XCircle },
};

function OrderStatusList({ orders }) {
  const [filter, setFilter] = useState("all");
  const tabs = ["all", "pending", "in-process", "delivered", "rejected"];
  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  return (
    <div className="scs-card rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#1A1220" }}><Package size={14} className="scs-maroon" /> Orders</h3>
      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`text-xs px-3 py-1 rounded-full capitalize ${filter === t ? "scs-btn" : "scs-btn-outline"}`}>{t}</button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-xs scs-muted">No orders here.</p>}
      <div className="space-y-2">
        {filtered.map((o) => {
          const meta = statusMeta[o.status];
          return (
            <div key={o.id} className="flex justify-between items-center text-sm py-2" style={{ borderBottom: "1px solid #ECE6EA" }}>
              <div>
                <div style={{ color: "#1A1220" }}>{o.items.length} item(s) · {fmt(o.total)}</div>
                <div className="text-xs scs-muted">{fmtDate(o.date)} · {o.courier}</div>
              </div>
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: meta.color }}>
                <meta.icon size={12} /> {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({ me, orders, partners, groups, withdrawals, referralLink, notify, requestWithdrawal, updatePassword }) {
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [wForm, setWForm] = useState({ amount: "", accountTitle: "", accountNumber: "", bankName: "" });

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(referralLink); notify("Referral link copied."); }
    catch (e) { notify(`Your ID: ${me.memberId}`); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Hi, {me.name.split(" ")[0]}</h2>
      <p className="scs-muted text-sm mb-8">Member ID: <span className="scs-maroon font-medium">{me.memberId}</span></p>

      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Wallet} label="Wallet balance" value={fmt(me.walletBalance)} />
        <StatCard icon={TrendingUp} label="Points" value={me.points} />
        <StatCard icon={Users} label="Partners" value={partners.length} />
        <StatCard icon={Award} label="Groups" value={groups} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="scs-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#1A1220" }}>Your referral link</h3>
          <div className="flex items-center gap-2 scs-input rounded-lg px-3 py-2 text-xs mb-2 overflow-hidden">
            <span className="truncate flex-1">{referralLink}</span>
            <button onClick={copyLink}><Copy size={14} className="scs-maroon" /></button>
          </div>
          <p className="text-xs scs-muted">Share this link — anyone who joins with it becomes your partner. Every {GROUP_SIZE} partners form one group.</p>
        </div>

        <div className="scs-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#1A1220" }}>Account & password</h3>
          <div className="flex items-center gap-2 scs-input rounded-lg px-3 py-2 text-xs mb-3">
            <span className="flex-1">{showPw ? me.password : "••••••••"}</span>
            <button onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={14} className="scs-muted" /> : <Eye size={14} className="scs-muted" />}</button>
          </div>
          <div className="flex gap-2">
            <input className="scs-input rounded-lg px-3 py-2 text-sm flex-1" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button onClick={() => { updatePassword(newPw); setNewPw(""); }} className="scs-btn rounded-lg px-4 text-sm font-semibold">Update</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <OrderStatusList orders={orders} />

        <div className="scs-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#1A1220" }}><Wallet size={14} className="scs-maroon" /> Withdraw funds</h3>
          {me.points < WITHDRAW_MIN_POINTS ? (
            <p className="text-xs scs-muted">You need {WITHDRAW_MIN_POINTS} points to withdraw. You currently have {me.points}.</p>
          ) : (
            <div className="space-y-2">
              <input className="scs-input rounded-lg px-3 py-2 text-sm w-full" placeholder="Amount" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm w-full" placeholder="Account title" value={wForm.accountTitle} onChange={(e) => setWForm({ ...wForm, accountTitle: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm w-full" placeholder="Account / IBAN number" value={wForm.accountNumber} onChange={(e) => setWForm({ ...wForm, accountNumber: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm w-full" placeholder="Bank / wallet name" value={wForm.bankName} onChange={(e) => setWForm({ ...wForm, bankName: e.target.value })} />
              <button onClick={() => { requestWithdrawal(wForm); setWForm({ amount: "", accountTitle: "", accountNumber: "", bankName: "" }); }} className="scs-btn rounded-lg py-2 w-full text-sm font-semibold">Request withdrawal</button>
            </div>
          )}
          {withdrawals.length > 0 && (
            <div className="mt-4 space-y-1">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex justify-between text-xs py-1" style={{ borderTop: "1px solid #ECE6EA" }}>
                  <span className="scs-muted">{fmt(w.amount)}</span>
                  <span className="capitalize" style={{ color: w.status === "paid" ? "#2E9E6D" : w.status === "rejected" ? "#C24444" : "#B4842B" }}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="scs-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#1A1220" }}><Users size={14} className="scs-maroon" /> Your partners ({partners.length})</h3>
        {partners.length === 0 && <p className="text-xs scs-muted">No one has joined with your link yet.</p>}
        <div className="space-y-2">
          {partners.map((u) => (
            <div key={u.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: "1px solid #ECE6EA" }}>
              <span style={{ color: "#1A1220" }}>{u.name}</span>
              <span className="text-xs scs-muted">joined {fmtDate(u.joinedAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Admin({ state, addProduct, removeProduct, adminUpdateOrderStatus, resolveWithdrawal }) {
  const [tab, setTab] = useState("orders");
  const [newProduct, setNewProduct] = useState({ name: "", category: "Skincare", image: "", consultantPrice: "", customerPrice: "", points: "", stock: "" });
  const [editing, setEditing] = useState({}); // orderId -> {cashback, points}

  const totalSales = state.orders.reduce((s, o) => s + o.total, 0);
  const totalCashback = state.users.reduce((s, u) => s + u.walletBalance, 0);

  const suggest = (order) => ({
    cashback: order.items.reduce((s, i) => s + (i.customerPrice - i.consultantPrice) * i.qty, 0),
    points: order.items.reduce((s, i) => s + i.points * i.qty, 0),
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Shield size={18} className="scs-maroon" />
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1A1220" }}>Admin panel</h2>
      </div>

      <div className="flex gap-2 mb-6 text-sm flex-wrap">
        {["orders", "overview", "members", "products", "withdrawals"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg capitalize ${tab === t ? "scs-btn" : "scs-btn-outline"}`}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Total members" value={state.users.length} />
          <StatCard icon={TrendingUp} label="Total sales" value={fmt(totalSales)} />
          <StatCard icon={Wallet} label="Total wallet balances" value={fmt(totalCashback)} />
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {state.orders.length === 0 && <p className="text-sm scs-muted">No orders yet.</p>}
          {state.orders.map((o) => {
            const sug = suggest(o);
            const draft = editing[o.id] || { cashback: o.cashbackAwarded ?? sug.cashback, points: o.pointsAwarded ?? sug.points };
            const meta = statusMeta[o.status];
            return (
              <div key={o.id} className="scs-card rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#1A1220" }}>{o.userName} ({o.memberId})</div>
                    <div className="text-xs scs-muted">{o.address.city} · {o.address.society} · {o.courier} · {fmtDate(o.date)}</div>
                    <div className="text-xs scs-muted">{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
                  </div>
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: meta.color }}><meta.icon size={12} /> {meta.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <input className="scs-input rounded-lg px-2 py-1.5 text-xs w-28" placeholder="Cashback" value={draft.cashback} onChange={(e) => setEditing({ ...editing, [o.id]: { ...draft, cashback: e.target.value } })} />
                  <input className="scs-input rounded-lg px-2 py-1.5 text-xs w-24" placeholder="Points" value={draft.points} onChange={(e) => setEditing({ ...editing, [o.id]: { ...draft, points: e.target.value } })} />
                  <button onClick={() => adminUpdateOrderStatus(o.id, "in-process", draft.cashback, draft.points)} disabled={o.status === "delivered"} className="scs-btn-outline text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">In Process</button>
                  <button onClick={() => adminUpdateOrderStatus(o.id, "delivered", draft.cashback, draft.points)} disabled={o.status === "delivered"} className="scs-btn text-xs px-3 py-1.5 rounded-lg disabled:opacity-40">{o.status === "delivered" ? "Delivered ✓" : "Mark Delivered"}</button>
                  <button onClick={() => adminUpdateOrderStatus(o.id, "rejected", draft.cashback, draft.points)} disabled={o.status === "delivered"} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ border: "1px solid #C24444", color: "#C24444" }}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "members" && (
        <div className="scs-card rounded-xl p-5">
          {state.users.map((u) => (
            <div key={u.id} className="flex justify-between text-sm py-2" style={{ borderBottom: "1px solid #ECE6EA" }}>
              <div>
                <div style={{ color: "#1A1220" }}>{u.name} <span className="scs-muted text-xs">({u.memberId})</span></div>
                <div className="text-xs scs-muted">{u.phone} · CNIC {u.cnic} · {u.sponsorId ? `sponsored by ${u.sponsorId}` : "no sponsor"}</div>
              </div>
              <div className="text-right">
                <div className="scs-maroon text-xs">{fmt(u.walletBalance)}</div>
                <div className="text-xs scs-muted">{u.points} pts</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "products" && (
        <div>
          <div className="scs-card rounded-xl p-5 mb-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#1A1220" }}>Add product</h3>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <input className="scs-input rounded-lg px-3 py-2 text-sm" placeholder="Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
              <select className="scs-input rounded-lg px-3 py-2 text-sm" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}>
                <option>Skincare</option><option>Haircare</option>
              </select>
              <div className="sm:col-span-2">
                <label className="scs-input rounded-lg px-3 py-2 text-sm w-full flex items-center justify-between cursor-pointer">
                  <span className="scs-muted">{newProduct.image ? "Photo selected ✓" : "Choose photo from gallery"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      try {
                        const base64 = await readAndResizeImage(file);
                        setNewProduct((p) => ({ ...p, image: base64 }));
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  />
                </label>
                {newProduct.image && (
                  <img src={newProduct.image} className="w-16 h-16 rounded-lg object-cover mt-2 bg-gray-100" />
                )}
              </div>
              <input className="scs-input rounded-lg px-3 py-2 text-sm" placeholder="Consultant price" value={newProduct.consultantPrice} onChange={(e) => setNewProduct({ ...newProduct, consultantPrice: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm" placeholder="Customer price" value={newProduct.customerPrice} onChange={(e) => setNewProduct({ ...newProduct, customerPrice: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm" placeholder="Points per unit" value={newProduct.points} onChange={(e) => setNewProduct({ ...newProduct, points: e.target.value })} />
              <input className="scs-input rounded-lg px-3 py-2 text-sm" placeholder="Stock" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} />
            </div>
            <button onClick={() => { addProduct(newProduct); setNewProduct({ name: "", category: "Skincare", image: "", consultantPrice: "", customerPrice: "", points: "", stock: "" }); }} className="scs-btn rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-1.5">
              <Plus size={14} /> Add product
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {state.products.map((p) => (
              <div key={p.id} className="scs-card rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={p.image} className="w-10 h-10 rounded object-cover bg-gray-100" onError={(e) => (e.target.style.display = "none")} />
                  <div>
                    <div className="text-sm" style={{ color: "#1A1220" }}>{p.name}</div>
                    <div className="text-xs scs-muted">{fmt(p.customerPrice)} · {p.stock} in stock · {p.points} pts</div>
                  </div>
                </div>
                <button onClick={() => removeProduct(p.id)}><Trash2 size={16} style={{ color: "#C24444" }} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="scs-card rounded-xl p-5">
          {state.withdrawals.length === 0 && <p className="text-sm scs-muted">No withdrawal requests.</p>}
          <div className="space-y-2">
            {state.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: "1px solid #ECE6EA" }}>
                <div>
                  <div style={{ color: "#1A1220" }}>{w.userName} ({w.memberId})</div>
                  <div className="text-xs scs-muted">{fmt(w.amount)} · {w.bankName} · {w.accountTitle} · {w.accountNumber}</div>
                </div>
                {w.status === "pending" ? (
                  <div className="flex gap-2">
                    <button onClick={() => resolveWithdrawal(w.id, "paid")} className="scs-btn-outline w-8 h-8 rounded flex items-center justify-center"><Check size={14} style={{ color: "#2E9E6D" }} /></button>
                    <button onClick={() => resolveWithdrawal(w.id, "rejected")} className="scs-btn-outline w-8 h-8 rounded flex items-center justify-center"><X size={14} style={{ color: "#C24444" }} /></button>
                  </div>
                ) : (
                  <span className="text-xs capitalize" style={{ color: w.status === "paid" ? "#2E9E6D" : "#C24444" }}>{w.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
