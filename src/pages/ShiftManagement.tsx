import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, getDaysInMonth, addMonths, subMonths, parse, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Copy, Download, AlertTriangle } from 'lucide-react';
import { User, ShiftType, CruiseShipInfo, Shift, HelperStaff } from '../types';
import {
  calculateMonthlyCost,
  calculateSalesTarget,
  calculateWorkDays,
  calculateUserCost,
  checkRequiredStaff,
  generateCSV,
  getRoleLabel
} from '../utils/shiftHelpers';
import { calculateMonthlyRevenue } from '../utils/revenueCalculator';
import { generateShiftWithAI, saveShiftData } from '../services/shiftService';

export function ShiftManagement() {
  const { currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [users, setUsers] = useState<User[]>([]);
  const [schedule, setSchedule] = useState<{ [userId: string]: { [day: string]: ShiftType } }>({});
  const [cruiseShips, setCruiseShips] = useState<CruiseShipInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCruiseModal, setShowCruiseModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [cruiseForm, setCruiseForm] = useState({
    arrivalTime: '',
    departureTime: '',
    shipName: '',
    passengerCapacity: 0,
    departurePort: '',
    previousPort: ''
  });
  const [shipNames, setShipNames] = useState<string[]>([]);
  const [ports, setPorts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [shiftModal, setShiftModal] = useState<{
    userId: string;
    userName: string;
    day: number;
    currentValue: ShiftType | null;
    isHelper?: boolean;
  } | null>(null);
  const [operatingDays, setOperatingDays] = useState(0);
  const [currentRevenue, setCurrentRevenue] = useState(0);
  const [displayOrders, setDisplayOrders] = useState<{ [userId: string]: number }>({});
  const [staffCategories, setStaffCategories] = useState<{ [userId: string]: string }>({});
  const [salesTargetDivisor, setSalesTargetDivisor] = useState(0.4);
  const [helpStaff, setHelpStaff] = useState<HelperStaff[]>([]);
  const [helperModal, setHelperModal] = useState({
    isOpen: false,
    name: '',
    category: '受付'
  });
  const [staffRequirements, setStaffRequirements] = useState<{
    captain: number;
    beach_staff: number;
    reception: number;
  }>({
    captain: 2,
    beach_staff: 0,
    reception: 2
  });

  const [settings, setSettings] = useState({
    dailyWages: { captain: 15000, beachStaff: 12000, reception: 10000 },
    staffCostRatio: 0.4,
    requiredStaff: { captains: 2, reception: 2, beachStaff: 0 }
  });

  const shiftPermission = currentUser?.permissions?.shiftManagement ||
    (['owner_executive', 'admin'].includes(currentUser?.role || '') ? 'edit' : 'view');

  const canEdit = shiftPermission === 'edit';
  const canView = shiftPermission === 'view' || canEdit;
  const isAdmin = ['owner_executive', 'admin'].includes(currentUser?.role || '');

  const canViewPersonnelCost = isAdmin || currentUser?.shiftDisplaySettings?.canViewPersonnelCost || false;
  const canViewMonthlySummary = isAdmin || currentUser?.shiftDisplaySettings?.canViewMonthlySummary || false;

  console.log('Shift Management - Current user role:', currentUser?.role);
  console.log('Shift Management - Permission:', shiftPermission);
  console.log('Shift Management - Can edit:', canEdit);

  useEffect(() => {
    loadData();
    initializeMonth();
    calculateOperatingDays();
    fetchRevenue();
    loadSalesTargetDivisor();
    loadStaffOrderAndCategories();
    loadSettings();
  }, [currentMonth]);

  useEffect(() => {
    if (!currentMonth) return;

    const monthRef = doc(db, 'shifts', currentMonth);
    const unsubscribe = onSnapshot(monthRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Shift;
        setSchedule(data.schedule || {});
      }
    });

    return () => unsubscribe();
  }, [currentMonth]);

  useEffect(() => {
    const loadCruiseData = async () => {
      try {
        const monthRef = doc(db, 'cruiseShips', currentMonth);
        const docSnap = await getDoc(monthRef);

        if (docSnap.exists()) {
          setCruiseShips(docSnap.data().ships || []);
        } else {
          setCruiseShips([]);
        }

        const masterRef = doc(db, 'cruiseMasters', 'data');
        const masterSnap = await getDoc(masterRef);

        if (masterSnap.exists()) {
          const masterData = masterSnap.data();
          setShipNames(masterData.shipNames || []);
          setPorts(masterData.ports || []);
        }
      } catch (error) {
        console.error('クルーズデータ読み込みエラー:', error);
      }
    };

    loadCruiseData();
  }, [currentMonth]);


  const holidays2025 = [
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-02-24',
    '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05',
    '2025-05-06', '2025-07-21', '2025-08-11', '2025-09-15', '2025-09-23',
    '2025-10-13', '2025-11-03', '2025-11-23', '2025-11-24'
  ];

  const isHoliday = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays2025.includes(dateStr);
  };

  const sortUsers = (usersList: User[]) => {
    const roleOrder: { [key: string]: number } = {
      'captain': 1,
      'beach_staff': 2,
      'reception': 3,
      'admin': 4,
      'owner_executive': 5
    };

    return [...usersList].sort((a, b) => {
      const orderA = roleOrder[a.role] || 999;
      const orderB = roleOrder[b.role] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'ja');
    });
  };

  const calculateOperatingDays = async () => {
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const daysInMonth = getDaysInMonth(parse(currentMonth, 'yyyy-MM', new Date()));
      let count = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const docRef = doc(db, 'boarding_data', dateStr);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const hasData = Object.values(data).some((boatData: any) =>
            boatData.trips && boatData.trips.length > 0
          );
          if (hasData) count++;
        }
      }

      setOperatingDays(count);
    } catch (error) {
      console.error('営業日数計算エラー:', error);
      setOperatingDays(0);
    }
  };

  const fetchRevenue = async () => {
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const totalRevenue = await calculateMonthlyRevenue(year, month);

      setCurrentRevenue(totalRevenue);
      console.log('現在売上:', totalRevenue);
    } catch (error) {
      console.error('売上取得エラー:', error);
      setCurrentRevenue(0);
    }
  };

  const loadSalesTargetDivisor = async () => {
    try {
      const docRef = doc(db, 'settings', 'shift_settings');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const ratio = data.staffCostRatio || data.salesTargetDivisor || 0.4;
        setSalesTargetDivisor(ratio);
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const generalRef = doc(db, 'settings', 'general');
      const generalSnap = await getDoc(generalRef);

      const shiftRef = doc(db, 'settings', 'shift_settings');
      const shiftSnap = await getDoc(shiftRef);

      const reqRef = doc(db, 'settings', 'staff_requirements');
      const reqSnap = await getDoc(reqRef);

      setSettings({
        dailyWages: generalSnap.exists() && generalSnap.data().dailyWages
          ? generalSnap.data().dailyWages
          : { captain: 15000, beachStaff: 12000, reception: 10000 },
        staffCostRatio: shiftSnap.exists()
          ? (shiftSnap.data().staffCostRatio || shiftSnap.data().salesTargetDivisor || 0.4)
          : 0.4,
        requiredStaff: reqSnap.exists()
          ? {
              captains: reqSnap.data().captain || 2,
              reception: reqSnap.data().reception || 2,
              beachStaff: reqSnap.data().beach_staff || 0
            }
          : { captains: 2, reception: 2, beachStaff: 0 }
      });
    } catch (error) {
      console.error('設定読み込みエラー:', error);
    }
  };

  const loadStaffOrderAndCategories = async () => {
    try {
      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.displayOrders) {
          setDisplayOrders(data.displayOrders);
        }
        if (data.staffCategories) {
          setStaffCategories(data.staffCategories);
        }
        if (data.helpStaff) {
          setHelpStaff(data.helpStaff);
        }
      }

      const settingsRef = doc(db, 'settings', 'shift_requirements');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        setStaffRequirements(settingsSnap.data() as any);
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    }
  };

  const initializeMonth = async () => {
    if (!currentUser) return;

    try {
      const monthRef = doc(db, 'shifts', currentMonth);
      const monthDoc = await getDoc(monthRef);

      if (!monthDoc.exists() && canEdit) {
        await setDoc(monthRef, {
          month: currentMonth,
          schedule: {},
          cruiseShips: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid
        });
        console.log('✅ 初期データを作成しました');
      }
    } catch (error) {
      console.error('初期化エラー:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadShifts()]);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const allStaff: User[] = [];

      snapshot.forEach(doc => {
        const userData = doc.data() as User;
        allStaff.push({
          ...userData,
          uid: doc.id,
          id: doc.id,
          name: userData.name || 'unknown',
          role: userData.role || '受付'
        });
      });

      // 現在の年月を取得
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // スタッフ一覧をフィルタリング
      const filteredStaff = allStaff.filter(staff => {
        // 📚 過去の月の場合は全員表示（AI学習のため）
        if (currentMonth < currentYearMonth) {
          console.log('[ShiftManagement] 過去の月 - 全員表示:', staff.name, {
            deleted: staff.deleted || false,
            showInShift: staff.permissions?.showInShift
          });
          return true;  // 削除済みでも表示！
        }

        // 🔄 今月以降は現役スタッフのみ
        // 削除済み（退職者）は表示しない
        if (staff.deleted) {
          console.log('[ShiftManagement] 今月以降 - 削除済みを非表示:', staff.name);
          return false;
        }

        // showInShift で判定（一時非表示など）
        const shouldShow = staff.permissions?.showInShift !== false;
        console.log('[ShiftManagement] 今月以降 - showInShift判定:', staff.name, shouldShow);
        return shouldShow;
      });

      console.log('[ShiftManagement] フィルタリング結果:', {
        selectedMonth: currentMonth,
        currentYearMonth,
        isPastMonth: currentMonth < currentYearMonth,
        total: allStaff.length,
        displayed: filteredStaff.length,
        deletedInPast: currentMonth < currentYearMonth ?
          allStaff.filter(s => s.deleted).length : 0,
        deletedInFuture: currentMonth >= currentYearMonth ?
          allStaff.filter(s => s.deleted).length : 0
      });

      const sorted = sortUsers(filteredStaff);
      setUsers(sorted);
    } catch (error) {
      console.error('ユーザー読み込みエラー:', error);
    }
  };

  const loadShifts = async () => {
    try {
      const docRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Shift;
        setSchedule(data.schedule || {});
        setCruiseShips(data.cruiseShips || {});
        setHelpStaff(data.helpers || []);
      } else {
        setSchedule({});
        setCruiseShips({});
        setHelpStaff([]);
      }
    } catch (error) {
      console.error('シフト読み込みエラー:', error);
    }
  };

  const saveShifts = async (
    newSchedule: { [userId: string]: { [day: string]: ShiftType } },
    newCruiseShips?: { [day: string]: CruiseShipInfo }
  ) => {
    if (!canEdit || !currentUser) return;

    try {
      const docRef = doc(db, 'shifts', currentMonth);
      const shiftData: Shift = {
        month: currentMonth,
        schedule: newSchedule,
        cruiseShips: newCruiseShips || cruiseShips,
        helpers: helpStaff,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.uid
      };

      await setDoc(docRef, shiftData);
      setSchedule(newSchedule);
      if (newCruiseShips) setCruiseShips(newCruiseShips);
    } catch (error) {
      console.error('シフト保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const selectShift = async (shift: ShiftType) => {
    if (!shiftModal) {
      console.error('shiftModal が null です');
      return;
    }

    console.log('=== selectShift 開始 ===');
    console.log('shiftModal:', shiftModal);
    console.log('shiftModal.userId:', shiftModal.userId);
    console.log('shiftModal.day:', shiftModal.day);
    console.log('選択されたshift:', shift);
    console.log('isHelper:', shiftModal.isHelper);

    if (!shiftModal.userId) {
      alert('エラー: ユーザーIDが無効です');
      console.error('shiftModal.userId が undefined です');
      return;
    }

    try {
      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {
        schedule: {},
        cruiseShips: {},
        displayOrders: {},
        staffCategories: {},
        helpers: []
      };

      if (shiftModal.isHelper) {
        // ヘルプスタッフの更新
        console.log('ヘルプスタッフのシフト更新');
        const updatedHelpers = (existingData.helpers || []).map((helper: HelperStaff) => {
          if (helper.id === shiftModal.userId) {
            return {
              ...helper,
              schedule: {
                ...helper.schedule,
                [String(shiftModal.day)]: shift === '-' ? null : shift
              }
            };
          }
          return helper;
        });

        await setDoc(monthRef, {
          ...existingData,
          helpers: updatedHelpers,
          updatedAt: new Date()
        });

        setHelpStaff(updatedHelpers);
        console.log('✅ ヘルプスタッフのシフト更新完了');
      } else {
        // 正規スタッフの更新
        console.log('更新前のschedule:', existingData.schedule);

        const currentUserSchedule = existingData.schedule[shiftModal.userId] || {};

        console.log(`ユーザー ${shiftModal.userId} の既存スケジュール:`, currentUserSchedule);

        const newSchedule = {
          ...existingData.schedule,
          [shiftModal.userId]: {
            ...currentUserSchedule,
            [shiftModal.day.toString()]: shift === '-' ? null : shift
          }
        };

        console.log('更新後のschedule:', newSchedule);

        await setDoc(monthRef, {
          ...existingData,
          schedule: newSchedule,
          updatedAt: new Date()
        });

        console.log('✅ Firestoreへの保存成功');

        setSchedule(newSchedule);
      }

      setShiftModal(null);

      console.log('✅ シフト更新完了');
    } catch (error: any) {
      console.error('❌ エラー:', error);
      alert(`保存に失敗しました: ${error.message}`);
    }
  };

  const handleAIGenerate = async () => {
    if (!currentUser?.permissions?.shiftManagement || currentUser.permissions.shiftManagement === 'none') {
      alert('シフト編集権限がありません');
      return;
    }

    if (!confirm('AIでシフトを自動生成しますか？\n既存のシフトは上書きされます。')) {
      return;
    }

    setAiGenerating(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          name: doc.data().name,
          category: doc.data().category || '受付',
        }))
        .filter(doc => {
          const data = usersSnapshot.docs.find(d => d.id === doc.id)?.data();
          return data?.role !== 'オーナー・役員';
        });

      console.log('ユーザー一覧:', usersList);

      const cruiseShipsData = cruiseShips.map(ship => ({
        day: parseInt(ship.date.split('-')[2]),
        hasShip: true,
      }));

      console.log('クルーズ情報:', cruiseShipsData);

      let requiredStaff = {
        captains: 2,
        reception: 2,
        beachStaff: 0
      };

      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data?.requiredStaff) {
            requiredStaff = data.requiredStaff;
          }
        }
      } catch (error) {
        console.warn('設定取得失敗、デフォルト値を使用:', error);
      }

      console.log('必要人数設定:', requiredStaff);

      const { generateSmartShift } = await import('../lib/smartShiftGenerator');
      const generatedShift = await generateSmartShift(
        currentMonth,
        usersList,
        cruiseShipsData,
        { requiredStaff }
      );

      console.log('生成されたシフト:', generatedShift);

      const monthRef = doc(db, 'shifts', currentMonth);
      await setDoc(monthRef, {
        ...generatedShift,
        updatedAt: new Date()
      });

      setSchedule(generatedShift.schedule);

      alert('✅ AIシフト生成が完了しました！');
    } catch (error) {
      console.error('AIシフト生成エラー:', error);
      alert('❌ AIシフト生成に失敗しました: ' + (error as Error).message);
    } finally {
      setAiGenerating(false);
    }
  };

  const exportToCSV = () => {
    const csv = generateCSV(schedule, users, currentMonth);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift_${currentMonth}.csv`;
    link.click();
  };

  const changeMonth = (delta: number) => {
    const date = parse(currentMonth, 'yyyy-MM', new Date());
    const newDate = addMonths(date, delta);
    setCurrentMonth(format(newDate, 'yyyy-MM'));
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    for (let i = -12; i <= 6; i++) {
      const date = addMonths(currentDate, i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'yyyy年M月', { locale: ja })
      });
    }

    return options;
  };

  const getDayOfWeek = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return dayNames[getDay(date)];
  };

  const handleCellClick = (
    userId: string | undefined,
    userName: string,
    day: number,
    currentValue: ShiftType | null,
    isHelper: boolean = false
  ) => {
    console.log('=== handleCellClick 呼び出し ===');
    console.log('受け取ったuserId:', userId);
    console.log('受け取ったuserName:', userName);
    console.log('受け取ったday:', day);
    console.log('受け取ったcurrentValue:', currentValue);
    console.log('isHelper:', isHelper);

    if (!userId) {
      alert('エラー: ユーザーIDが無効です');
      console.error('userId が undefined です');
      return;
    }

    if (!canEdit) return;

    setShiftModal({
      userId,
      userName,
      day,
      currentValue,
      isHelper
    });

    console.log('モーダルを開きました:', { userId, userName, day, currentValue, isHelper });
  };

  const moveUserUp = async (currentIndex: number) => {
    if (currentIndex <= 0) return;

    try {
      const sortedUsers = getSortedUsers;
      const newOrder = [...sortedUsers];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] =
        [newOrder[currentIndex], newOrder[currentIndex - 1]];

      const newDisplayOrders: { [uid: string]: number } = {};
      newOrder.forEach((user, index) => {
        newDisplayOrders[user.uid] = index + 1;
      });

      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(monthRef, {
        ...existingData,
        displayOrders: newDisplayOrders
      });

      setDisplayOrders(newDisplayOrders);
      console.log('✅ 表示順更新成功');
    } catch (error) {
      console.error('❌ 表示順更新エラー:', error);
      alert('表示順の更新に失敗しました');
    }
  };

  const moveUserDown = async (currentIndex: number) => {
    const sortedUsers = getSortedUsers;
    if (currentIndex >= sortedUsers.length - 1) return;

    try {
      const newOrder = [...sortedUsers];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] =
        [newOrder[currentIndex + 1], newOrder[currentIndex]];

      const newDisplayOrders: { [uid: string]: number } = {};
      newOrder.forEach((user, index) => {
        newDisplayOrders[user.uid] = index + 1;
      });

      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(monthRef, {
        ...existingData,
        displayOrders: newDisplayOrders
      });

      setDisplayOrders(newDisplayOrders);
      console.log('✅ 表示順更新成功');
    } catch (error) {
      console.error('❌ 表示順更新エラー:', error);
      alert('表示順の更新に失敗しました');
    }
  };

  const getDailyWage = (category: string) => {
    if (!category) return settings.dailyWages.reception;

    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('\u8239\u9577')) {
      return settings.dailyWages.captain;
    } else if (categoryLower.includes('\u6d5c')) {
      return settings.dailyWages.beachStaff;
    } else {
      return settings.dailyWages.reception;
    }
  };

  const calculateStaffStats = (userId: string, userSchedule: { [day: string]: string } | undefined, userRole: string) => {
    let workDays = 0;
    let holidays = 0;

    Object.values(userSchedule || {}).forEach(value => {
      if (value === '\u25cb' || value === '\u3007') workDays += 1;
      else if (value === '\u5348\u524d' || value === '\u5348\u5f8c') workDays += 0.5;
      else if (value === '\u4f11') holidays += 1;
    });

    const dailyWage = getDailyWage(userRole);
    const totalCost = workDays * dailyWage;

    return { workDays, holidays, totalCost };
  };

  const handleCategoryChange = async (userId: string, category: string) => {
    try {
      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      console.log('更新前のカテゴリ:', existingData.staffCategories);
      console.log('更新対象:', userId, category);

      const newStaffCategories = {
        ...existingData.staffCategories,
        [userId]: category
      };

      console.log('更新後のカテゴリ:', newStaffCategories);

      await setDoc(monthRef, {
        ...existingData,
        staffCategories: newStaffCategories
      });

      setStaffCategories(newStaffCategories);

      console.log('✅ カテゴリ更新成功:', userId, category);
    } catch (error) {
      console.error('❌ カテゴリ更新エラー:', error);
      alert('カテゴリの更新に失敗しました');
    }
  };

  const getSortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const orderA = displayOrders[a.uid] || 999;
      const orderB = displayOrders[b.uid] || 999;
      return orderA - orderB;
    });
  }, [users, displayOrders]);

  const daysInMonth = getDaysInMonth(parse(currentMonth, 'yyyy-MM', new Date()));

  const addHelpStaff = () => {
    setHelperModal({ isOpen: true, name: '', category: '受付' });
  };

  const updateHelpStaffName = async (helpId: string, newName: string) => {
    try {
      const newHelpStaff = helpStaff.map(h =>
        h.id === helpId ? { ...h, name: newName } : h
      );

      setHelpStaff(newHelpStaff);

      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(monthRef, {
        ...existingData,
        helpStaff: newHelpStaff
      });
    } catch (error) {
      console.error('❌ ヘルプスタッフ名更新エラー:', error);
    }
  };

  const updateHelpStaffCategory = async (helpId: string, newCategory: 'captain' | 'beach_staff' | 'reception') => {
    try {
      const newHelpStaff = helpStaff.map(h =>
        h.id === helpId ? { ...h, category: newCategory } : h
      );

      setHelpStaff(newHelpStaff);

      const monthRef = doc(db, 'shifts', currentMonth);
      const docSnap = await getDoc(monthRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(monthRef, {
        ...existingData,
        helpStaff: newHelpStaff
      });

      console.log('✅ ヘルプスタッフカテゴリ更新成功');
    } catch (error) {
      console.error('❌ ヘルプスタッフカテゴリ更新エラー:', error);
      alert('カテゴリの更新に失敗しました');
    }
  };

  const handleAddHelper = async () => {
    if (!helperModal.name.trim()) {
      alert('名前を入力してください');
      return;
    }

    if (!currentMonth) {
      alert('月が選択されていません');
      return;
    }

    const newHelper: HelperStaff = {
      id: `helper_${Date.now()}`,
      name: helperModal.name.trim(),
      category: helperModal.category,
      schedule: {}
    };

    const updatedHelpers = [...helpStaff, newHelper];

    try {
      const shiftRef = doc(db, 'shifts', currentMonth);
      await updateDoc(shiftRef, {
        helpers: updatedHelpers
      });

      setHelpStaff(updatedHelpers);
      setHelperModal({ isOpen: false, name: '', category: '受付' });
      alert('✅ ヘルプスタッフを追加しました');
    } catch (error: any) {
      console.error('ヘルプ追加エラー:', error);

      if (error.code === 'not-found') {
        try {
          await setDoc(doc(db, 'shifts', currentMonth), {
            month: currentMonth,
            schedule: schedule,
            helpers: [newHelper],
            cruiseShips: cruiseShips || {},
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: currentUser?.uid || ''
          });

          setHelpStaff([newHelper]);
          setHelperModal({ isOpen: false, name: '', category: '受付' });
          alert('✅ ヘルプスタッフを追加しました');
        } catch (createError) {
          console.error('シフト作成エラー:', createError);
          alert('❌ 追加に失敗しました');
        }
      } else {
        alert('❌ 追加に失敗しました');
      }
    }
  };

  const handleDeleteHelper = async (helperId: string) => {
    if (!confirm('このヘルプスタッフを削除しますか？')) {
      return;
    }

    if (!currentMonth) return;

    const updatedHelpers = helpStaff.filter(h => h.id !== helperId);

    try {
      await updateDoc(doc(db, 'shifts', currentMonth), {
        helpers: updatedHelpers
      });

      setHelpStaff(updatedHelpers);
      alert('✅ ヘルプスタッフを削除しました');
    } catch (error) {
      console.error('ヘルプ削除エラー:', error);
      alert('❌ 削除に失敗しました');
    }
  };

  const removeHelpStaff = handleDeleteHelper;

  const checkShortage = (day: string): string[] => {
    if (!schedule || !users || users.length === 0) return [];

    const dayStr = String(day);
    let captains = 0;
    let beach = 0;
    let reception = 0;

    // \u6b63\u898f\u30b9\u30bf\u30c3\u30d5\u3092\u30ab\u30a6\u30f3\u30c8
    users.forEach(user => {
      const shift = schedule[user.uid]?.[dayStr];
      if (!shift || shift === '\u4f11' || shift === '-') return;

      const count = (shift === '\u25cb' || shift === '\u3007') ? 1 :
                    (shift === '\u5348\u524d' || shift === '\u5348\u5f8c') ? 0.5 : 0;

      if (count === 0) return;

      const category = user.category || user.role || '';

      // \u30c7\u30d0\u30c3\u30b0: category\u304cundefined\u306e\u5834\u5408
      if (!category) {
        console.warn(`\u26a0\ufe0f User ${user.name} (${user.uid}) has no category or role`);
      }

      if (category.includes('\u8239\u9577')) {
        captains += count;
      } else if (category.includes('\u6d5c')) {
        beach += count;
      } else {
        reception += count;
      }
    });

    // \u30d8\u30eb\u30d7\u30b9\u30bf\u30c3\u30d5\u3092\u30ab\u30a6\u30f3\u30c8
    (helpStaff || []).forEach(helper => {
      const shift = helper.schedule?.[dayStr];
      if (!shift || shift === '\u4f11' || shift === '-') return;

      const count = (shift === '\u25cb' || shift === '\u3007') ? 1 :
                    (shift === '\u5348\u524d' || shift === '\u5348\u5f8c') ? 0.5 : 0;

      if (count === 0) return;

      const category = helper.category || '';
      if (category.includes('\u8239\u9577')) {
        captains += count;
      } else if (category.includes('\u6d5c')) {
        beach += count;
      } else {
        reception += count;
      }
    });

    const need = settings?.requiredStaff || { captains: 2, reception: 2, beachStaff: 0 };

    const result: string[] = [];
    if (captains < need.captains) result.push(`\u8239\u9577${Math.ceil(need.captains - captains)}\u540d`);
    if (reception < need.reception) result.push(`\u53d7\u4ed8${Math.ceil(need.reception - reception)}\u540d`);
    if (beach < need.beachStaff) result.push(`\u6d5c${Math.ceil(need.beachStaff - beach)}\u540d`);

    return result;
  };

  const checkStaffRequirements = (day: number): {
    captainShortage: number;
    beachStaffShortage: number;
    receptionShortage: number;
    needsHelp: boolean;
  } => {
    let captainCount = 0;
    let beachStaffCount = 0;
    let receptionCount = 0;

    getSortedUsers.forEach(user => {
      const shift = schedule[user.uid]?.[day.toString()];
      const category = staffCategories[user.uid];

      if (shift === '〇' || shift === '午前' || shift === '午後') {
        if (category === 'captain') captainCount++;
        if (category === 'beach_staff') beachStaffCount++;
        if (category === 'reception') receptionCount++;
      }
    });

    helpStaff.forEach(help => {
      const shift = schedule[help.id]?.[day.toString()];
      if (shift === '〇' || shift === '午前' || shift === '午後') {
        if (help.category === 'captain') captainCount++;
        if (help.category === 'beach_staff') beachStaffCount++;
        if (help.category === 'reception') receptionCount++;
      }
    });

    const captainShortage = Math.max(0, staffRequirements.captain - captainCount);
    const beachStaffShortage = Math.max(0, staffRequirements.beach_staff - beachStaffCount);
    const receptionShortage = Math.max(0, staffRequirements.reception - receptionCount);

    return {
      captainShortage,
      beachStaffShortage,
      receptionShortage,
      needsHelp: captainShortage > 0 || beachStaffShortage > 0 || receptionShortage > 0
    };
  };

  const calculateSalesTarget = (personnelCost: number, divisor: number = 0.4) => {
    return personnelCost / divisor;
  };

  const saveCruiseInfo = async () => {
    try {
      const newCruise: CruiseShipInfo = {
        id: `cruise_${Date.now()}`,
        date: selectedDate,
        ...cruiseForm
      };

      const newCruiseShips = [...cruiseShips.filter(c => c.date !== selectedDate), newCruise];

      const monthRef = doc(db, 'cruiseShips', currentMonth);
      await setDoc(monthRef, {
        ships: newCruiseShips
      });

      setCruiseShips(newCruiseShips);

      const newShipNames = shipNames.includes(cruiseForm.shipName)
        ? shipNames
        : [...shipNames, cruiseForm.shipName].sort();

      const newPorts = new Set([...ports, cruiseForm.departurePort, cruiseForm.previousPort].filter(p => p));

      if (newShipNames.length > shipNames.length || newPorts.size > ports.length) {
        const masterRef = doc(db, 'cruiseMasters', 'data');
        await setDoc(masterRef, {
          shipNames: newShipNames,
          ports: Array.from(newPorts).sort()
        });

        setShipNames(newShipNames);
        setPorts(Array.from(newPorts).sort());
      }

      setShowCruiseModal(false);
      alert('✅ クルーズ船情報を保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('❌ 保存に失敗しました');
    }
  };

  const deleteCruiseShip = async (dateStr: string) => {
    try {
      const newCruiseShips = cruiseShips.filter(c => c.date !== dateStr);

      const monthRef = doc(db, 'cruiseShips', currentMonth);
      await setDoc(monthRef, {
        ships: newCruiseShips
      });

      setCruiseShips(newCruiseShips);
      alert('✅ 削除しました');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('❌ 削除に失敗しました');
    }
  };

  if (!canView) {
    return (
      <Layout>
        <div className="text-center text-gray-600 dark:text-gray-400">
          アクセス権限がありません
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  const totalLaborCost = users.reduce((sum, user) => {
    const stats = calculateStaffStats(user.uid, schedule[user.uid], user.category || '受付');
    return sum + stats.totalCost;
  }, 0) + (helpStaff || []).reduce((sum, helper) => {
    const stats = calculateStaffStats(helper.id, helper.schedule, helper.category);
    return sum + stats.totalCost;
  }, 0);

  const salesTarget = totalLaborCost / settings.staffCostRatio;
  const salesTargetAchievement = salesTarget > 0 ? (currentRevenue / salesTarget * 100) : 0;

  const totalCost = calculateMonthlyCost(schedule, users);
  const warnings = checkRequiredStaff(schedule, users, currentMonth);
  const personnelCostAchievement = totalCost > 0 ? (currentRevenue / totalCost * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📅 シフト管理</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>

              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 text-lg font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                style={{ minHeight: '44px' }}
              >
                {generateMonthOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={handleAIGenerate}
                  disabled={aiGenerating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                  style={{ minHeight: '44px' }}
                >
                  <span>🤖</span>
                  <span>{aiGenerating ? 'AI生成中...' : 'AIシフト自動生成'}</span>
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  style={{ minHeight: '44px' }}
                >
                  <Download className="w-4 h-4" />
                  <span>CSV出力</span>
                </button>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="mb-4">
              <button
                onClick={addHelpStaff}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center space-x-2"
              >
                <span>+</span>
                <span>ヘルプ追加</span>
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 p-2 bg-teal-900 dark:bg-teal-950 sticky left-0 z-20 min-w-[120px]">
                    <div className="text-center">
                      <div className="text-xs text-teal-200">営業日数</div>
                      <div className="text-2xl font-bold text-white">{operatingDays}日</div>
                    </div>
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const [year, month] = currentMonth.split('-').map(Number);
                    const dayOfWeek = getDay(new Date(year, month - 1, day));
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;
                    const holiday = isHoliday(year, month, day);
                    const dayName = getDayOfWeek(year, month, day);

                    return (
                      <th
                        key={day}
                        className={`border border-gray-300 dark:border-gray-600 px-2 py-2 text-center min-w-[60px] ${
                          isSaturday && !holiday ? 'bg-blue-100 dark:bg-blue-900/30' :
                          isSunday || holiday ? 'bg-red-50 dark:bg-red-900/20' :
                          'bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        <div className="text-center">
                          <div className={`font-bold ${
                            isSunday || holiday ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {day}
                          </div>
                          <div className={`text-xs ${
                            isSunday || holiday
                              ? 'text-red-500 dark:text-red-300 font-bold'
                              : isSaturday
                              ? 'text-blue-600 dark:text-blue-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            ({dayName})
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-center min-w-[80px]">
                    <span className="text-gray-900 dark:text-white font-bold text-sm whitespace-nowrap">出勤日数</span>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-center min-w-[80px]">
                    <span className="text-gray-900 dark:text-white font-bold text-sm whitespace-nowrap">休日数</span>
                  </th>
                  {canViewPersonnelCost && (
                    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-center min-w-[100px]">
                      <span className="text-gray-900 dark:text-white font-bold text-sm whitespace-nowrap">人件費</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-blue-50 dark:bg-blue-900/20">
                  <td className="sticky left-0 bg-blue-100 dark:bg-blue-900/30 border border-gray-300 dark:border-gray-600 p-2 font-bold text-gray-900 dark:text-white">
                    クルーズ
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                    const hasCruise = cruiseShips.some(c => c.date === dateStr);

                    return (
                      <td key={day} className="border border-gray-300 dark:border-gray-600 p-2 text-center">
                        {canEdit ? (
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasCruise}
                              onChange={() => {
                                if (hasCruise) {
                                  if (confirm('クルーズ船情報を削除しますか？')) {
                                    deleteCruiseShip(dateStr);
                                  }
                                } else {
                                  setSelectedDate(dateStr);
                                  setCruiseForm({
                                    arrivalTime: `${dateStr}T10:00`,
                                    departureTime: `${dateStr}T16:00`,
                                    shipName: '',
                                    passengerCapacity: 0,
                                    departurePort: '',
                                    previousPort: ''
                                  });
                                  setShowCruiseModal(true);
                                }
                              }}
                              className="w-5 h-5 cursor-pointer"
                            />
                            {hasCruise && <span className="ml-1">🚢</span>}
                          </label>
                        ) : (
                          hasCruise && <span>🚢</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 dark:border-gray-600" colSpan={canViewPersonnelCost ? 3 : 2}></td>
                </tr>

                {getSortedUsers.map((user, index) => {
                  const userSchedule = schedule[user.uid] || {};
                  const workDays = calculateWorkDays(userSchedule);
                  const cost = calculateUserCost(userSchedule, user.role);

                  return (
                    <tr key={user.uid}>
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            {canEdit && (
                              <div className="flex flex-col">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveUserUp(index);
                                  }}
                                  disabled={index === 0}
                                  className={`text-xs px-1 ${index === 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer'}`}
                                  title="上に移動"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveUserDown(index);
                                  }}
                                  disabled={index === getSortedUsers.length - 1}
                                  className={`text-xs px-1 ${index === getSortedUsers.length - 1 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer'}`}
                                  title="下に移動"
                                >
                                  ▼
                                </button>
                              </div>
                            )}
                            <span className="text-lg mr-1">
                              {user.category?.includes('船長') ? '🚢' :
                               user.category?.includes('浜') ? '🏖️' : '📝'}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const shiftValue = userSchedule[day.toString()] || '';

                        return (
                          <td
                            key={day}
                            className={`border border-gray-300 dark:border-gray-600 p-2 text-center min-w-[60px] ${
                              canEdit ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20' : ''
                            } ${shiftValue === '休' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                            onClick={() => {
                              console.log('=== セルクリック ===');
                              console.log('user:', user);
                              console.log('user.uid:', user.uid);
                              console.log('user.name:', user.name);
                              console.log('day:', day);
                              console.log('shiftValue:', shiftValue);

                              if (!user.uid) {
                                alert('エラー: ユーザーIDが取得できません');
                                return;
                              }

                              handleCellClick(user.uid, user.name, day, shiftValue || null);
                            }}
                          >
                            <span className={`block py-2 ${shiftValue === '休' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                              {shiftValue || '-'}
                            </span>
                          </td>
                        );
                      })}
                      {(() => {
                        const stats = calculateStaffStats(user.uid, schedule[user.uid], user.category || '受付');
                        return (
                          <>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                              {stats.workDays}日
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                              {stats.holidays}日
                            </td>
                            {canViewPersonnelCost && (
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                ¥{stats.totalCost.toLocaleString()}
                              </td>
                            )}
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}

                {helpStaff.map(help => {
                  const helpSchedule = help.schedule || {};
                  const categoryIcon = help.category.includes('船長') ? '🚢' :
                                       help.category.includes('浜') ? '🏖️' : '📝';

                  return (
                    <tr key={help.id} className="bg-purple-50 dark:bg-purple-900/20">
                      <td className="border border-gray-300 dark:border-gray-600 px-2 py-3 sticky left-0 bg-purple-100 dark:bg-purple-900/30 z-10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{categoryIcon}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{help.name}</span>
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">(ヘルプ)</span>
                          </div>
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeHelpStaff(help.id);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold px-2"
                              title="削除"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const shiftValue = helpSchedule[day.toString()] || '';

                        return (
                          <td
                            key={day}
                            className={`border border-gray-300 dark:border-gray-600 p-2 text-center min-w-[60px] ${
                              canEdit ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20' : ''
                            } ${shiftValue === '休' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCellClick(
                                help.id,
                                help.name,
                                day,
                                (shiftValue || '-') as ShiftType,
                                true
                              );
                            }}
                          >
                            <span className={`block py-2 ${shiftValue === '休' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                              {shiftValue || '-'}
                            </span>
                          </td>
                        );
                      })}
                      {(() => {
                        const stats = calculateStaffStats(help.id, helpSchedule, help.category);
                        return (
                          <>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                              {stats.workDays}日
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                              {stats.holidays}日
                            </td>
                            {canViewPersonnelCost && (
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                ¥{stats.totalCost.toLocaleString()}
                              </td>
                            )}
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        </div>

        {/* 必要人員チェック - 常に表示 */}
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
            ⚠️ 必要人員チェック⚠️
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const shortages = checkShortage(String(day));
              if (shortages.length === 0) return null;

              return (
                <div
                  key={day}
                  className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded p-2 text-center"
                >
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{day}日</div>
                  <div className="text-xs mt-1">
                    {shortages.map((s, i) => (
                      <div key={i} className="text-red-700 dark:text-red-300">{s}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {cruiseShips.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center text-gray-900 dark:text-white">
              <span className="mr-2">🚢</span>
              クルーズ船情報
            </h3>

            <div className="space-y-3">
              {cruiseShips.sort((a, b) => a.date.localeCompare(b.date)).map(cruise => (
                <div key={cruise.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">日付:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{cruise.date}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">船名:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{cruise.shipName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">入港:</span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {new Date(cruise.arrivalTime).toLocaleString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">出航:</span>{' '}
                      <span className="text-gray-900 dark:text-white">
                        {new Date(cruise.departureTime).toLocaleString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">定員:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{cruise.passengerCapacity.toLocaleString()}名</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">出航地:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{cruise.departurePort}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300">前港:</span>{' '}
                      <span className="text-gray-900 dark:text-white">{cruise.previousPort}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canViewMonthlySummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              📊 月間集計
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">総人件費:</span>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    ¥{totalLaborCost.toLocaleString()}
                  </span>
                  <span className={`text-lg font-semibold ${
                    currentRevenue >= totalLaborCost ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {totalLaborCost > 0 ? ((currentRevenue / totalLaborCost) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">売上目標:</span>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-teal-600 dark:text-teal-400">
                    ¥{Math.round(salesTarget).toLocaleString()}
                  </span>
                  <span className={`text-lg font-semibold ${
                    currentRevenue >= salesTarget ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {salesTarget > 0 ? ((currentRevenue / salesTarget) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-gray-300 font-semibold">現在売上:</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ¥{currentRevenue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {shiftModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShiftModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {shiftModal.userName} - {currentMonth}月{shiftModal.day}日
            </h3>

            <div className="space-y-2">
              {['〇', '午前', '午後', '休', '-'].map(shift => (
                <button
                  key={shift}
                  onClick={() => selectShift(shift as ShiftType)}
                  className={`
                    w-full px-4 py-3 text-lg rounded-lg border-2 transition-all
                    ${shiftModal.currentValue === shift
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:border-teal-500'
                    }
                  `}
                >
                  {shift}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShiftModal(null)}
              className="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {showCruiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">🚢 クルーズ船情報</h3>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">入港日時</label>
                <input
                  type="datetime-local"
                  value={cruiseForm.arrivalTime}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, arrivalTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">出航日時</label>
                <input
                  type="datetime-local"
                  value={cruiseForm.departureTime}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, departureTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">船名</label>
                <input
                  type="text"
                  list="ship-names"
                  value={cruiseForm.shipName}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, shipName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="船名を入力またはプルダウンから選択"
                />
                <datalist id="ship-names">
                  {shipNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">旅客定員</label>
                <input
                  type="number"
                  value={cruiseForm.passengerCapacity || ''}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, passengerCapacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="例: 3000"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">出航地</label>
                <input
                  type="text"
                  list="ports"
                  value={cruiseForm.departurePort}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, departurePort: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="例: 横浜"
                />
                <datalist id="ports">
                  {ports.map(port => (
                    <option key={port} value={port} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">前港</label>
                <input
                  type="text"
                  list="ports-prev"
                  value={cruiseForm.previousPort}
                  onChange={(e) => setCruiseForm({ ...cruiseForm, previousPort: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="例: 神戸"
                />
                <datalist id="ports-prev">
                  {ports.map(port => (
                    <option key={port} value={port} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex space-x-2 mt-6">
              <button
                onClick={saveCruiseInfo}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                保存
              </button>
              <button
                onClick={() => setShowCruiseModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {generationProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="text-lg font-medium text-gray-900 dark:text-white">{generationProgress}</span>
            </div>
          </div>
        </div>
      )}

      {helperModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">➕ ヘルプスタッフ追加</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">名前 *</label>
                <input
                  type="text"
                  value={helperModal.name}
                  onChange={(e) => setHelperModal({ ...helperModal, name: e.target.value })}
                  placeholder="ヘルプスタッフの名前"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">カテゴリー *</label>
                <select
                  value={helperModal.category}
                  onChange={(e) => setHelperModal({ ...helperModal, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                >
                  <option value="船長">🚢 船長</option>
                  <option value="浜スタッフ">🏖️ 浜スタッフ</option>
                  <option value="受付">📝 受付</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setHelperModal({ isOpen: false, name: '', category: '受付' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                style={{ minHeight: '44px' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleAddHelper}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold"
                style={{ minHeight: '44px' }}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
