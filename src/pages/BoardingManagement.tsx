import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BOAT_CAPACITY, BOAT_NAMES } from '../constants';
import { format, addDays, subDays, parse, addMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Trip, TripEntry, AttendantPricing, InitialTimes } from '../types';
import {
  generateTimeSlots,
  calculateCommission,
  calculateAmount,
  getNextTripTime,
  calculateTripSummary,
  calculateBoatSummary,
  calculateAllBoatsSummary
} from '../utils/boardingHelpers';

interface BoardingState {
  [boatName: string]: {
    trips: Trip[];
  };
}

export function BoardingManagement() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBoat, setSelectedBoat] = useState<string>('カジ');
  const [boardingData, setBoardingData] = useState<BoardingState>({});
  const [attendants, setAttendants] = useState<string[]>([]);
  const [attendantPricing, setAttendantPricing] = useState<AttendantPricing[]>([]);
  const [basePricing, setBasePricing] = useState({ adult: 5000, child: 3000, infant: 0 });
  const [initialTimes, setInitialTimes] = useState<InitialTimes>({
    kaji: '09:00',
    mui: '09:15',
    tida: '09:00'
  });
  const [loading, setLoading] = useState(true);
  const [dailySchedule, setDailySchedule] = useState<string[]>([]);
  const [customTimeMode, setCustomTimeMode] = useState<{[key: number]: boolean}>({});

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const trips = boardingData[selectedBoat]?.trips || [];
  const timeSlots = generateTimeSlots();

  const boardingPermission = currentUser?.permissions?.boardingManagement ||
    (['owner_executive', 'admin', 'reception'].includes(currentUser?.role || '') ? 'edit' : 'none');

  if (boardingPermission === 'none') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">アクセス拒否</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">乗船管理へのアクセス権限がありません</p>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              style={{ minHeight: '44px' }}
            >
              戻る
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const canEdit = boardingPermission === 'edit';

  const getInitialScheduleState = () => {
    const saved = localStorage.getItem('showSchedule');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return canEdit;
  };

  const [showSchedule, setShowSchedule] = useState(getInitialScheduleState);

  const toggleSchedule = () => {
    const newState = !showSchedule;
    setShowSchedule(newState);
    localStorage.setItem('showSchedule', JSON.stringify(newState));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'boarding_data', dateStr),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as BoardingState;
          setBoardingData(data);
        } else {
          setBoardingData({});
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to boarding data:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dateStr]);

  const currentTripsData = useMemo(() => {
    return JSON.stringify(boardingData[selectedBoat]?.trips || []);
  }, [boardingData, selectedBoat]);

  useEffect(() => {
    const currentTrips = JSON.parse(currentTripsData);
    const schedule = generateActualSchedule(currentTrips, selectedBoat);
    setDailySchedule(schedule);
  }, [currentTripsData, selectedBoat, initialTimes.kaji, initialTimes.mui, initialTimes.tida]);

  const getInitialTime = (boatName: string) => {
    const boatKey = boatName === 'カジ' ? 'kaji' :
                    boatName === 'ムイ' ? 'mui' : 'tida';
    return initialTimes[boatKey] || '09:00';
  };

  const generateFullDaySchedule = (startTime: string) => {
    const schedule: string[] = [];
    try {
      let current = parse(startTime, 'HH:mm', new Date());
      const endTime = parse('17:00', 'HH:mm', new Date());

      while (current <= endTime) {
        schedule.push(format(current, 'HH:mm'));
        current = addMinutes(current, 35);
      }
    } catch (e) {
      console.error('Error generating schedule:', e);
    }
    return schedule;
  };

  const generateActualSchedule = (trips: Trip[], boatName: string) => {
    if (!trips || trips.length === 0) {
      const initialTime = getInitialTime(boatName);
      return generateFullDaySchedule(initialTime);
    }

    const firstTime = trips[0].time;
    const baseSchedule = generateFullDaySchedule(firstTime);
    const actualSchedule = [...baseSchedule];

    trips.forEach((trip, idx) => {
      if (actualSchedule[idx] !== undefined) {
        actualSchedule[idx] = trip.time;

        for (let i = idx + 1; i < actualSchedule.length; i++) {
          try {
            const prevTime = parse(actualSchedule[i - 1], 'HH:mm', new Date());
            actualSchedule[i] = format(addMinutes(prevTime, 35), 'HH:mm');
          } catch (e) {
            break;
          }
        }
      }
    });

    return actualSchedule;
  };


  const filteredSchedule = dailySchedule.filter(time => {
    try {
      const now = new Date();
      const scheduleDateTime = parse(time, 'HH:mm', selectedDate);
      return scheduleDateTime >= now;
    } catch (e) {
      return false;
    }
  });

  const loadSettings = async () => {
    try {
      const generalDoc = await getDoc(doc(db, 'settings', 'general'));
      if (generalDoc.exists()) {
        const data = generalDoc.data();

        const salesChannels = data.salesChannels || [];
        setAttendants(salesChannels.map((sc: any) => sc.name));

        setAttendantPricing(salesChannels);

        if (data.initialTimes) {
          setInitialTimes(data.initialTimes);
        }
      }

      const pricingDoc = await getDoc(doc(db, 'settings', 'pricing'));
      if (pricingDoc.exists()) {
        setBasePricing(pricingDoc.data() as any);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const debounce = <T extends (...args: any[]) => any>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const saveDataFn = async (data: BoardingState) => {
    try {
      await setDoc(doc(db, 'boarding_data', dateStr), data, { merge: true });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const saveData = debounce(saveDataFn, 500);

  const updateBoardingData = (newData: BoardingState) => {
    setBoardingData(newData);
    saveData(newData);
  };

  const addTrip = () => {
    let newTime: string;

    if (trips.length === 0) {
      newTime = getInitialTime(selectedBoat);
    } else {
      const lastTrip = trips[trips.length - 1];
      try {
        const lastTime = parse(lastTrip.time, 'HH:mm', new Date());
        newTime = format(addMinutes(lastTime, 35), 'HH:mm');
      } catch (e) {
        newTime = getNextTripTime(lastTrip.time);
      }
    }

    const newTrip: Trip = {
      time: newTime,
      entries: [],
      capacityMode: 'B',
      totalPassengers: 0,
      revenue: 0
    };

    const updatedData = {
      ...boardingData,
      [selectedBoat]: {
        trips: [...trips, newTrip]
      }
    };

    updateBoardingData(updatedData);
  };

  const removeTrip = (tripIndex: number) => {
    const updatedTrips = trips.filter((_, i) => i !== tripIndex);
    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };
    updateBoardingData(updatedData);
  };

  const addEntry = (tripIndex: number) => {
    const newEntry: TripEntry = {
      adult: 0,
      child: 0,
      infant: 0,
      attendant: '',
      revenue: 0,
      commission: 0,
      profit: 0,
      japaneseOk: false
    };

    const updatedTrips = [...trips];
    updatedTrips[tripIndex].entries.push(newEntry);

    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };

    updateBoardingData(updatedData);
  };

  const removeEntry = (tripIndex: number, entryIndex: number) => {
    const updatedTrips = [...trips];
    updatedTrips[tripIndex].entries = updatedTrips[tripIndex].entries.filter((_, i) => i !== entryIndex);

    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };

    updateBoardingData(updatedData);
  };

  const updateTrip = (tripIndex: number, field: keyof Trip, value: any) => {
    const updatedTrips = [...trips];
    (updatedTrips[tripIndex] as any)[field] = value;

    if (field === 'time') {
      for (let i = tripIndex + 1; i < updatedTrips.length; i++) {
        const prevTime = parse(updatedTrips[i - 1].time, 'HH:mm', new Date());
        updatedTrips[i].time = format(addMinutes(prevTime, 35), 'HH:mm');
      }
    }

    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };

    updateBoardingData(updatedData);
  };

  const toggleCapacityMode = (tripIndex: number) => {
    const updatedTrips = [...trips];
    updatedTrips[tripIndex].capacityMode = updatedTrips[tripIndex].capacityMode === 'A' ? 'B' : 'A';

    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };

    updateBoardingData(updatedData);
  };

  const updateEntry = (tripIndex: number, entryIndex: number, field: keyof TripEntry, value: any) => {
    const updatedTrips = [...trips];
    const entry = updatedTrips[tripIndex].entries[entryIndex];
    (entry as any)[field] = value;

    if (field === 'attendant' || field === 'adult' || field === 'child' || field === 'infant') {
      if (entry.attendant) {
        const channel = attendantPricing.find((ch: any) => ch.name === entry.attendant);

        if (channel) {
          entry.revenue =
            (entry.adult || 0) * (channel.pricing?.adult || 0) +
            (entry.child || 0) * (channel.pricing?.child || 0) +
            (entry.infant || 0) * (channel.pricing?.infant || 0);

          if (channel.commission) {
            entry.commission =
              (entry.adult || 0) * (channel.commission.adult || 0) +
              (entry.child || 0) * (channel.commission.child || 0) +
              (entry.infant || 0) * (channel.commission.infant || 0);
          } else {
            entry.commission = 0;
          }

          entry.profit = entry.revenue - entry.commission;
        }

        if (entry.attendant === 'タクシー') {
          entry.commission = calculateCommission(entry.adult || 0, entry.child || 0, entry.attendant);
          entry.profit = entry.revenue - entry.commission;
        }
      }
    }

    const updatedData = {
      ...boardingData,
      [selectedBoat]: { trips: updatedTrips }
    };

    updateBoardingData(updatedData);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  const capacity = BOAT_CAPACITY[selectedBoat as keyof typeof BOAT_CAPACITY];
  const boatSummary = calculateBoatSummary(trips, selectedBoat);
  const allBoatsSummary = calculateAllBoatsSummary(boardingData);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">乗船管理</h1>
        </div>

        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
              <button
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {format(selectedDate, 'yyyy年MM月dd日(E)', { locale: ja })}
              </h2>

              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                style={{ minHeight: '44px' }}
              />

              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex space-x-2 mb-4 overflow-x-auto">
              {BOAT_NAMES.map(boat => (
                <button
                  key={boat}
                  onClick={() => setSelectedBoat(boat)}
                  className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedBoat === boat
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  {boat} ({BOAT_CAPACITY[boat as keyof typeof BOAT_CAPACITY]}名)
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">時刻表</span>

              <button
                onClick={toggleSchedule}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 ${
                  showSchedule ? 'bg-teal-500' : 'bg-gray-400 dark:bg-gray-600'
                }`}
                aria-label="時刻表の表示切替"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    showSchedule ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>

              {showSchedule && filteredSchedule.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  (残り{filteredSchedule.length}便)
                </span>
              )}
            </div>

            {showSchedule && filteredSchedule.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {filteredSchedule.map((time, idx) => {
                    const isRegistered = trips.some(trip => trip.time === time);

                    return (
                      <div
                        key={`${time}-${idx}`}
                        className={`px-3 py-1 rounded-md font-medium text-sm ${
                          isRegistered
                            ? 'bg-teal-600 text-white'
                            : 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                        }`}
                      >
                        {time}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="space-y-6">
            {trips.map((trip, tripIndex) => {
              const summary = calculateTripSummary(trip, selectedBoat);
              const isOverCapacity = summary.calculatedCapacity > capacity;

              return (
                <div key={tripIndex} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      {!customTimeMode[tripIndex] ? (
                        <select
                          value={trip.time}
                          onChange={(e) => {
                            if (e.target.value === '時間外') {
                              setCustomTimeMode({ ...customTimeMode, [tripIndex]: true });
                            } else {
                              updateTrip(tripIndex, 'time', e.target.value);
                            }
                          }}
                          disabled={!canEdit}
                          className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-bold text-lg ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        >
                          <option value="">時刻を選択</option>
                          {timeSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                          <option disabled>──────────</option>
                          <option value="時間外">⏰ 時間外</option>
                        </select>
                      ) : (
                        <>
                          <input
                            type="time"
                            value={trip.time}
                            onChange={(e) => updateTrip(tripIndex, 'time', e.target.value)}
                            disabled={!canEdit}
                            className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-bold text-lg ${
                              !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                            style={{ minHeight: '44px' }}
                          />
                          <button
                            onClick={() => {
                              setCustomTimeMode({ ...customTimeMode, [tripIndex]: false });
                            }}
                            disabled={!canEdit}
                            className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            style={{ minHeight: '44px' }}
                          >
                            プルダウンに戻す
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => toggleCapacityMode(tripIndex)}
                        disabled={!canEdit}
                        className={`px-4 py-2 text-sm font-bold border-2 rounded-lg ${
                          trip.capacityMode === 'B'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-300'
                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                        style={{ minHeight: '44px' }}
                      >
                        {trip.capacityMode === 'B' ? '減員' : '通常'}
                      </button>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => removeTrip(tripIndex)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        style={{ minHeight: '44px', minWidth: '44px' }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {isOverCapacity && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-800 rounded-lg flex items-center space-x-3">
                      <span className="text-3xl">⚠️</span>
                      <p className="text-red-800 dark:text-red-200 font-bold text-lg">
                        定員超過: {summary.calculatedCapacity.toFixed(1)}/{capacity}名
                      </p>
                    </div>
                  )}

                  <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
                    <span className="text-lg font-bold text-blue-900 dark:text-blue-200">
                      残席: {summary.remainingCapacity.toFixed(1)}名分
                    </span>
                  </div>

                  <div className="space-y-3">
                    {trip.entries.map((entry, entryIndex) => (
                      <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-9 gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <input
                          type="number"
                          value={entry.adult || ''}
                          onChange={(e) => updateEntry(tripIndex, entryIndex, 'adult', parseInt(e.target.value) || 0)}
                          disabled={!canEdit}
                          placeholder="大人"
                          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        />
                        <input
                          type="number"
                          value={entry.child || ''}
                          onChange={(e) => updateEntry(tripIndex, entryIndex, 'child', parseInt(e.target.value) || 0)}
                          disabled={!canEdit}
                          placeholder="子供"
                          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        />
                        <input
                          type="number"
                          value={entry.infant || ''}
                          onChange={(e) => updateEntry(tripIndex, entryIndex, 'infant', parseInt(e.target.value) || 0)}
                          disabled={!canEdit}
                          placeholder="幼児"
                          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        />
                        <select
                          value={entry.attendant}
                          onChange={(e) => updateEntry(tripIndex, entryIndex, 'attendant', e.target.value)}
                          disabled={!canEdit}
                          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        >
                          <option value="">アテンダント</option>
                          {attendants.map(att => (
                            <option key={att} value={att}>{att}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={entry.revenue || ''}
                          disabled
                          placeholder="売上(¥)"
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 dark:text-white cursor-not-allowed"
                          style={{ minHeight: '44px' }}
                        />
                        <input
                          type="number"
                          value={entry.commission || ''}
                          onChange={(e) => updateEntry(tripIndex, entryIndex, 'commission', parseInt(e.target.value) || 0)}
                          disabled={!canEdit}
                          placeholder="販促費"
                          className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:text-white ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          style={{ minHeight: '44px' }}
                        />
                        <input
                          type="number"
                          value={entry.profit || ''}
                          disabled
                          placeholder="粗利(¥)"
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-green-50 dark:bg-green-900/20 dark:text-white cursor-not-allowed"
                          style={{ minHeight: '44px' }}
                        />
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={entry.japaneseOk}
                            onChange={(e) => updateEntry(tripIndex, entryIndex, 'japaneseOk', e.target.checked)}
                            disabled={!canEdit}
                            className={`w-5 h-5 text-teal-500 rounded ${
                              !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">日本語</span>
                        </label>
                        {canEdit && (
                          <button
                            onClick={() => removeEntry(tripIndex, entryIndex)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            style={{ minHeight: '44px' }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => addEntry(tripIndex)}
                      className="mt-3 flex items-center space-x-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg"
                      style={{ minHeight: '44px' }}
                    >
                      <Plus className="w-5 h-5" />
                      <span>エントリー追加</span>
                    </button>
                  )}

                  <div className="mt-4 p-4 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-lg border-l-4 border-teal-500">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="font-bold text-xl text-teal-700 dark:text-teal-300">
                        合計: {summary.totalAdults + summary.totalChildren + summary.totalInfants}名
                        <span className="text-base ml-2">({summary.totalAdults}+{summary.totalChildren}+{summary.totalInfants})</span>
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">組数: <span className="font-bold">{summary.totalGroups}組</span></span>
                      <span className="text-gray-700 dark:text-gray-300">乗船率: <span className="font-bold">{summary.utilizationRate}%</span></span>
                      <span className="text-blue-700 dark:text-blue-400 text-lg">売上: <span className="font-bold">¥{summary.totalRevenue.toLocaleString()}</span></span>
                      <span className="text-yellow-700 dark:text-yellow-400">販促費: <span className="font-bold">¥{summary.totalCommission.toLocaleString()}</span></span>
                      <span className="text-green-700 dark:text-green-400 text-lg">粗利: <span className="font-bold">¥{summary.totalProfit.toLocaleString()}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {canEdit && (
            <button
              onClick={addTrip}
              className="mt-6 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-bold text-lg"
              style={{ minHeight: '44px' }}
            >
              <Plus className="w-6 h-6" />
              <span>便を追加</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-teal-900 dark:bg-teal-950 rounded-lg shadow-xl p-6 border-2 border-teal-600">
            <h3 className="text-2xl font-bold text-white mb-4">
              {selectedBoat} 本日の集計
            </h3>
            <div className="space-y-3 text-white">
              <div className="text-lg">
                総乗船者数: <span className="font-bold text-3xl text-teal-200">{boatSummary.totalPassengers}名</span>
                <div className="text-sm text-teal-300 mt-1">
                  (大人{boatSummary.totalAdults}名 子供{boatSummary.totalChildren}名 幼児{boatSummary.totalInfants}名)
                </div>
              </div>
              <div className="text-lg">総乗船組数: <span className="font-bold text-xl">{boatSummary.totalGroups}組</span></div>
              <div className="text-lg">乗船率: <span className="font-bold text-xl">{boatSummary.utilizationRate}%</span></div>
              <div className="text-lg">出航数: <span className="font-bold text-xl">{boatSummary.tripCount}便</span></div>
              <div className="text-xl font-bold text-blue-300 border-t border-teal-700 pt-3">
                総売上: ¥{boatSummary.totalRevenue.toLocaleString()}
              </div>
              <div className="text-lg text-yellow-300">
                販促費: ¥{boatSummary.totalCommission.toLocaleString()}
              </div>
              <div className="text-2xl font-bold text-emerald-300 border-t-2 border-emerald-400 pt-3">
                粗利: ¥{boatSummary.totalProfit.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-blue-900 dark:bg-blue-950 rounded-lg shadow-xl p-6 border-2 border-blue-600">
            <h3 className="text-2xl font-bold text-white mb-4">
              全体集計
            </h3>
            <div className="space-y-3 text-white">
              <div className="text-lg">
                総乗船者数: <span className="font-bold text-3xl text-blue-200">{allBoatsSummary.totalPassengers}名</span>
                <div className="text-sm text-blue-300 mt-1">
                  (大人{allBoatsSummary.totalAdults}名 子供{allBoatsSummary.totalChildren}名 幼児{allBoatsSummary.totalInfants}名)
                </div>
              </div>
              <div className="text-lg">総乗船組数: <span className="font-bold text-xl">{allBoatsSummary.totalGroups}組</span></div>
              <div className="text-lg">
                出航数:
                {allBoatsSummary.kajiTrips > 0 && <span className="ml-2">カジ{allBoatsSummary.kajiTrips}便</span>}
                {allBoatsSummary.muiTrips > 0 && <span className="ml-2">ムイ{allBoatsSummary.muiTrips}便</span>}
                {allBoatsSummary.tidaTrips > 0 && <span className="ml-2">ティダ{allBoatsSummary.tidaTrips}便</span>}
                <span className="ml-2 font-bold text-xl">(合計{allBoatsSummary.tripCount}便)</span>
              </div>
              <div className="text-lg">
                平均乗船率:
                {allBoatsSummary.kajiTrips > 0 && <span className="ml-2">カジ{allBoatsSummary.kajiUtilization}%</span>}
                {allBoatsSummary.muiTrips > 0 && <span className="ml-2">ムイ{allBoatsSummary.muiUtilization}%</span>}
                {allBoatsSummary.tidaTrips > 0 && <span className="ml-2">ティダ{allBoatsSummary.tidaUtilization}%</span>}
              </div>
              <div className="text-xl font-bold text-green-300 border-t border-blue-700 pt-3">
                総売上: ¥{allBoatsSummary.totalRevenue.toLocaleString()}
              </div>
              <div className="text-lg text-yellow-300">
                販促費: ¥{allBoatsSummary.totalCommission.toLocaleString()}
              </div>
              <div className="text-2xl font-bold text-emerald-300 border-t-2 border-emerald-400 pt-3">
                粗利: ¥{allBoatsSummary.totalProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
