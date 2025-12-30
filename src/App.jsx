import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Unlock, 
  Users, 
  LogOut, 
  Plus, 
  Trash2, 
  BarChart3,
  AlertCircle,
  X,
  UserMinus,
  Upload,
  CalendarDays,
  Edit2
} from 'lucide-react';

// --- Firebase Configuration ---
// REPLACE THIS OBJECT WITH YOUR ACTUAL CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyD_UvcafJ7k1BQ4_RkcUFGT9svCIM3o9S8",
  authDomain: "pharmacy-schedule.firebaseapp.com",
  projectId: "pharmacy-schedule",
  storageBucket: "pharmacy-schedule.firebasestorage.app",
  messagingSenderId: "936842910184",
  appId: "1:936842910184:web:e475d5b5dba4ac03c32c5d",
  measurementId: "G-T1NT642CB3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'pharmacy-schedule-kulim';

// --- Constants & Utilities ---
const DEPARTMENT_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-yellow-100 text-yellow-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
];

const getDeptColorClass = (dept) => {
  if (!dept) return 'bg-gray-100 text-gray-800';
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % DEPARTMENT_COLORS.length;
  return DEPARTMENT_COLORS[index];
};

const formatDate = (date) => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
};

const DEFAULT_FESTIVE_DATA = {
  "2026-01-17": "Israk & Mikraj",
  "2026-02-01": "Thaipusam",
  "2026-02-17": "Tahun Baru Cina",
  "2026-02-18": "Tahun Baru Cina",
  "2026-02-19": "Awal Ramadhan",
  "2026-03-21": "Hari Raya Aidilfitri",
  "2026-03-22": "Hari Raya Aidilfitri",
  "2026-05-01": "Hari Pekerja",
  "2026-05-27": "Hari Raya Haji",
  "2026-08-31": "Hari Kebangsaan",
  "2026-12-25": "Hari Krismas"
};

// --- Reusable Modal ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [settings, setSettings] = useState({ unlockedMonths: [], holidays: DEFAULT_FESTIVE_DATA });
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showHolidayPanel, setShowHolidayPanel] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsView, setStatsView] = useState('monthly');
  
  const [userFormData, setUserFormData] = useState({ fullName: '', nickName: '', email: '', department: '', isAdmin: false });
  const [editingUserId, setEditingUserId] = useState(null);

  const [holidayFormData, setHolidayFormData] = useState({ date: '', name: '' });
  const [editingHolidayKey, setEditingHolidayKey] = useState(null);
  const fileInputRef = useRef(null);
  
  const [confirmModal, setConfirmModal] = useState({ show: false, scheduleId: null, message: '' });
  const [regWarning, setRegWarning] = useState({ show: false, message: '' });
  const [deleteUserConfirm, setDeleteUserConfirm] = useState({ show: false, userId: null, name: '' });

  // Auth Initialization
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth);
      } else {
        setFirebaseUser(u);
      }
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Real-time Data Listeners
  useEffect(() => {
    if (!firebaseUser) return;
    
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const uList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(uList);
      if (currentUser) {
        const updatedMe = uList.find(u => u.email === currentUser.email);
        if (updatedMe) setCurrentUser(updatedMe);
        else if (currentUser.id !== 'temp-admin') setCurrentUser(null);
      }
    });

    const schedulesRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedule');
    const unsubSchedules = onSnapshot(schedulesRef, (snapshot) => {
      const sortedSchedules = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      setSchedules(sortedSchedules);
    });

    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'settings');
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      const globalSettings = snapshot.docs.find(d => d.id === 'global');
      if (globalSettings) { 
        setSettings(globalSettings.data()); 
      } else {
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), {
          unlockedMonths: [], 
          holidays: DEFAULT_FESTIVE_DATA
        });
      }
    });

    return () => { unsubUsers(); unsubSchedules(); unsubSettings(); };
  }, [firebaseUser, currentUser?.email]);

  // Logic Helpers
  const isLocked = (date) => {
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    return !settings.unlockedMonths?.includes(monthKey);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const foundUser = users.find(u => u.email.toLowerCase() === loginEmail.trim().toLowerCase());
    if (foundUser) { setCurrentUser(foundUser); setLoginEmail(''); }
    else { setLoginError('Rekod staf tidak dijumpai. Sila hubungi Admin.'); }
  };

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    const newHolidays = { ...settings.holidays };
    if (editingHolidayKey && editingHolidayKey !== holidayFormData.date) {
      delete newHolidays[editingHolidayKey];
    }
    newHolidays[holidayFormData.date] = holidayFormData.name;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), { holidays: newHolidays });
    setHolidayFormData({ date: '', name: '' });
    setEditingHolidayKey(null);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const newHolidays = { ...settings.holidays };
      lines.forEach(line => {
        const [date, name] = line.split(',').map(s => s?.trim());
        if (date && name && /^\d{4}-\d{2}-\d{2}$/.test(date)) newHolidays[date] = name;
      });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), { holidays: newHolidays });
    };
    reader.readAsText(file);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...userFormData, email: userFormData.email.trim().toLowerCase() };
    if (editingUserId) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', editingUserId), payload);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users'), { ...payload, createdAt: new Date().toISOString() });
    }
    resetUserForm();
  };

  const resetUserForm = () => {
    setUserFormData({ fullName: '', nickName: '', email: '', department: '', isAdmin: false });
    setEditingUserId(null);
  };

  const toggleMonthLock = async () => {
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
    let newUnlocked = [...(settings.unlockedMonths || [])];
    if (newUnlocked.includes(monthKey)) newUnlocked = newUnlocked.filter(m => m !== monthKey);
    else newUnlocked.push(monthKey);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), { unlockedMonths: newUnlocked });
  };

  const handleDateClick = async (day) => {
    if (!currentUser || (isLocked(day) && !currentUser.isAdmin)) return;
    const dateStr = formatDate(day);
    const existingBlock = schedules.find(s => s.date === dateStr && s.userId === currentUser.id);
    if (existingBlock) {
      setConfirmModal({ show: true, scheduleId: existingBlock.id, message: `Padam block anda pada ${dateStr}?` });
    } else {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedule', `${dateStr}_${currentUser.id}`), {
        date: dateStr, userId: currentUser.id, userNick: currentUser.nickName, userDept: currentUser.department, createdAt: new Date().toISOString()
      });
    }
  };

  const generateMonthData = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      const ds = formatDate(d);
      return { 
        date: ds, 
        dayObj: d, 
        isWeekend: [5, 6].includes(d.getDay()), 
        holidayName: settings.holidays?.[ds], 
        blocks: schedules.filter(s => s.date === ds) 
      };
    });
  };

  const getStats = () => {
    const stats = {};
    users.forEach(u => { stats[u.nickName] = { weekday: 0, weekendHoliday: 0, total: 0 }; });
    const filterBlocks = statsView === 'monthly' 
      ? schedules.filter(s => s.date.startsWith(formatDate(currentDate).substring(0, 7)))
      : schedules.filter(s => s.date.startsWith(currentDate.getFullYear().toString()));

    filterBlocks.forEach(block => {
      if (stats[block.userNick]) {
        stats[block.userNick].total++;
        const dateObj = new Date(block.date);
        if ([5, 6].includes(dateObj.getDay()) || !!settings.holidays?.[block.date]) stats[block.userNick].weekendHoliday++;
        else stats[block.userNick].weekday++;
      }
    });
    return stats;
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const monthData = generateMonthData(currentDate);
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-28 bg-gray-50 border border-gray-100"></div>);
    monthData.forEach((day, i) => {
      const isToday = new Date().toDateString() === day.dayObj.toDateString();
      days.push(
        <div key={i} onClick={() => handleDateClick(day.dayObj)} className={`h-28 border p-2 relative transition-all ${(day.isWeekend || day.holidayName) ? 'bg-gray-100' : 'bg-white'} ${isToday ? 'ring-2 ring-blue-500 z-10' : ''} cursor-pointer hover:bg-blue-50`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-bold ${day.holidayName ? 'text-red-600' : 'text-gray-500'}`}>{i + 1}</span>
            {day.holidayName && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-bold truncate max-w-[80%]">{day.holidayName}</span>}
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[4.5rem]">
            {day.blocks.map(block => (
              <div key={block.id} className={`text-[10px] py-0.5 px-1.5 rounded truncate font-medium border border-black/5 ${getDeptColorClass(block.userDept)}`}>
                {block.userNick}
              </div>
            ))}
          </div>
        </div>
      );
    });
    return days;
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 font-bold text-gray-400 italic">MEMUATKAN...</div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-xl shadow-xl w-full max-w-md border">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="bg-blue-600 p-4 rounded-xl shadow-lg mb-4 text-white"><Calendar size={32} /></div>
            <h2 className="text-2xl font-bold text-gray-800">Hospital Kulim</h2>
            <p className="text-gray-500 text-sm">Log Masuk Kakitangan Farmasi</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <input type="email" required className="block w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Emel Rasmi" />
            {loginError && <p className="text-red-600 text-xs font-bold text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold hover:bg-blue-700">Log Masuk</button>
          </form>
          {users.length === 0 && (
            <button onClick={() => setCurrentUser({ id: 'temp-admin', nickName: 'Setup Admin', isAdmin: true, department: 'Admin', email: 'admin@setup.com' })} className="mt-6 w-full text-xs font-bold text-gray-400 underline uppercase tracking-widest">Setup First Admin</button>
          )}
        </div>
      </div>
    );
  }

  const isCurrentMonthLocked = isLocked(currentDate);
  const showLockState = isCurrentMonthLocked && !currentUser.isAdmin;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 h-16 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Calendar className="text-blue-600" size={24}/>
          <h1 className="text-lg font-bold text-gray-800">Jadual Block Farmasi Kulim</h1>
        </div>
        <div className="flex gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold leading-none">{currentUser.nickName}</p>
            <p className="text-[10px] text-blue-600 font-bold uppercase">{currentUser.department}</p>
          </div>
          <div className="flex gap-1 border-l pl-4">
            {currentUser.isAdmin && (
              <>
                <button onClick={() => setShowAdminPanel(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Urus Staf"><Users size={20}/></button>
                <button onClick={() => setShowHolidayPanel(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Urus Cuti Am"><CalendarDays size={20}/></button>
                <button onClick={() => setShowStats(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Statistik Block"><BarChart3 size={20}/></button>
              </>
            )}
            <button onClick={() => setCurrentUser(null)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"><LogOut size={20}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col gap-6">
        <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg border bg-white shadow-sm"><ChevronLeft size={20}/></button>
            <h2 className="text-xl font-bold text-gray-800 min-w-[200px] text-center">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg border bg-white shadow-sm"><ChevronRight size={20}/></button>
          </div>
          {currentUser.isAdmin && (
             <button onClick={toggleMonthLock} className={`px-4 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all shadow-sm ${isCurrentMonthLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {isCurrentMonthLocked ? <><Lock size={14}/> Buka Jadual</> : <><Unlock size={14}/> Kunci Jadual</>}
             </button>
          )}
        </div>

        {showLockState ? (
          <div className="flex-1 bg-white border rounded-2xl flex flex-col items-center justify-center p-12 text-center">
            <Lock size={64} className="text-gray-300 mb-6" />
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Jadual Dikunci</h3>
            <p className="text-gray-500">Admin belum membuka tempahan untuk bulan ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'].map(d => (
                <div key={d} className="py-3 text-center text-[10px] font-bold text-gray-400 uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-gray-100 gap-px">{renderCalendar()}</div>
          </div>
        )}
      </main>

      {/* Admin Modals */}
      <Modal isOpen={showHolidayPanel} onClose={() => { setShowHolidayPanel(false); setEditingHolidayKey(null); }} title="Urus Cuti Am">
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2"><Upload size={16} /> Import via CSV</h4>
            <p className="text-xs text-blue-600 mb-3">Format CSV: YYYY-MM-DD, Nama Cuti</p>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="text-xs" />
          </div>
          <form onSubmit={handleHolidaySubmit} className="flex gap-3">
            <input type="date" required className="p-2 border rounded-lg text-sm" value={holidayFormData.date} onChange={e => setHolidayFormData({...holidayFormData, date: e.target.value})} />
            <input type="text" placeholder="Nama Cuti" required className="flex-1 p-2 border rounded-lg text-sm" value={holidayFormData.name} onChange={e => setHolidayFormData({...holidayFormData, name: e.target.value})} />
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Simpan</button>
          </form>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {Object.entries(settings.holidays || {}).sort(([a],[b]) => a.localeCompare(b)).map(([date, name]) => (
               <div key={date} className="p-3 bg-white border rounded-xl flex justify-between items-center group">
                 <div className="text-sm">
                   <p className="font-bold text-blue-600">{date}</p>
                   <p className="text-gray-800">{name}</p>
                 </div>
                 <button onClick={async () => {
                    const h = {...settings.holidays}; delete h[date];
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), { holidays: h });
                 }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
               </div>
             ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAdminPanel} onClose={() => { setShowAdminPanel(false); resetUserForm(); }} title="Urus Kakitangan">
        <div className="space-y-6">
          <form onSubmit={handleUserSubmit} className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl">
            <input type="text" required placeholder="Nama Penuh" className="p-2.5 bg-white border rounded-lg text-sm" value={userFormData.fullName} onChange={e => setUserFormData({...userFormData, fullName: e.target.value})} />
            <input type="text" required placeholder="Nama Ringkas" className="p-2.5 bg-white border rounded-lg text-sm" value={userFormData.nickName} onChange={e => setUserFormData({...userFormData, nickName: e.target.value})} />
            <input type="email" required placeholder="Emel Rasmi" className="col-span-2 p-2.5 bg-white border rounded-lg text-sm" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
            <select className="p-2.5 bg-white border rounded-lg text-sm" value={userFormData.department} onChange={e => setUserFormData({...userFormData, department: e.target.value})}>
               <option value="">Bahagian</option>
               {['Bekalan Wad', 'Klinikal', 'Logistik', 'Maklumat Ubat', 'Pengeluaran', 'Pesakit Luar'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold px-3">
              <input type="checkbox" checked={userFormData.isAdmin} onChange={e => setUserFormData({...userFormData, isAdmin: e.target.checked})} /> Admin
            </label>
            <button className="col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold">Daftar / Kemaskini</button>
          </form>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="p-3 bg-white border rounded-xl flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getDeptColorClass(u.department)}`}>{u.nickName[0]}</div>
                  <div>
                    <p className="text-sm font-bold">{u.nickName} {u.isAdmin && '★'}</p>
                    <p className="text-[10px] text-gray-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                   <button onClick={() => { setEditingUserId(u.id); setUserFormData({...u}); }} className="p-2 text-gray-400 hover:text-blue-600"><Edit2 size={16}/></button>
                   <button onClick={() => setDeleteUserConfirm({ show: true, userId: u.id, name: u.fullName })} className="p-2 text-gray-400 hover:text-red-600"><UserMinus size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={showStats} onClose={() => setShowStats(false)} title="Statistik Block">
         <div className="space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
               <button onClick={() => setStatsView('monthly')} className={`px-4 py-2 rounded-md text-xs font-bold ${statsView === 'monthly' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Bulanan</button>
               <button onClick={() => setStatsView('yearly')} className={`px-4 py-2 rounded-md text-xs font-bold ${statsView === 'yearly' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tahunan</button>
            </div>
            <table className="w-full text-xs">
               <thead className="bg-gray-50 border-b">
                  <tr>
                     <th className="p-3 text-left">Staf</th>
                     <th className="p-3 text-center">Weekday</th>
                     <th className="p-3 text-center">W-end/Cuti</th>
                     <th className="p-3 text-center">Jumlah</th>
                  </tr>
               </thead>
               <tbody>
                  {Object.entries(getStats()).map(([name, s]) => (
                     <tr key={name} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-bold">{name}</td>
                        <td className="p-3 text-center">{s.weekday}</td>
                        <td className="p-3 text-center text-blue-600 font-bold">{s.weekendHoliday}</td>
                        <td className="p-3 text-center bg-gray-50 font-bold">{s.total}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </Modal>

      {/* Confirmations */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white p-8 rounded-xl max-w-sm w-full text-center border">
            <h3 className="text-lg font-bold mb-6">{confirmModal.message}</h3>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ show: false, scheduleId: null, message: '' })} className="flex-1 py-3 bg-gray-100 rounded-lg">Batal</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedule', confirmModal.scheduleId)); setConfirmModal({ show: false, scheduleId: null, message: '' }); }} className="flex-1 py-3 bg-red-600 text-white rounded-lg">Padam</button>
            </div>
          </div>
        </div>
      )}

      {deleteUserConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white p-8 rounded-xl max-w-sm w-full text-center border">
            <h3 className="text-lg font-bold mb-8">Padam akaun {deleteUserConfirm.name}?</h3>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserConfirm({ show: false, userId: null, name: '' })} className="flex-1 py-3 bg-gray-100 rounded-lg">Batal</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', deleteUserConfirm.userId)); setDeleteUserConfirm({ show: false, userId: null, name: '' }); }} className="flex-1 py-3 bg-red-600 text-white rounded-lg">Sahkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}