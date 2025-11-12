import { Trip, TripEntry, AttendantPricing } from '../types';
import { BOAT_CAPACITY } from '../constants';
import { addMinutes, parse, format } from 'date-fns';

export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 9; hour <= 17; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      if (hour === 17 && minute > 0) break;
      slots.push(time);
    }
  }
  return slots;
};

export const calculateCapacity = (
  entry: TripEntry,
  capacityMode: 'A' | 'B',
  boatName: string
): number => {
  const adultCount = entry.adult || 0;
  const childCount = entry.child || 0;

  if (capacityMode === 'A') {
    return adultCount + (childCount * 0.5);
  } else {
    const childRate = (boatName === 'ムイ' || boatName === 'カジ') ? 0.75 : 0.5;
    return adultCount + (childCount * childRate);
  }
};

export const calculateTripCapacity = (trip: Trip, boatName: string): number => {
  return trip.entries.reduce((sum, entry) => {
    return sum + calculateCapacity(entry, trip.capacityMode || 'A', boatName);
  }, 0);
};

export const calculateCommission = (
  adult: number,
  child: number,
  attendant: string
): number => {
  if (attendant === 'タクシー') {
    return (adult * 300) + (child * 150);
  }
  return 0;
};

export const getAttendantRate = (
  attendant: string,
  date: string,
  attendantPricing: AttendantPricing[]
): number => {
  const pricing = attendantPricing.find(p => p.attendant === attendant);
  if (!pricing) return 0;

  const period = pricing.periods.find(p => {
    return date >= p.start && date <= p.end;
  });

  return period ? period.rate : pricing.defaultRate;
};

export const calculateAmount = (
  adult: number,
  child: number,
  infant: number,
  attendant: string,
  date: string,
  basePricing: { adult: number; child: number; infant: number },
  attendantPricing: AttendantPricing[]
): number => {
  const baseAmount =
    (adult * basePricing.adult) +
    (child * basePricing.child) +
    (infant * basePricing.infant);

  const attendantRate = getAttendantRate(attendant, date, attendantPricing);

  return baseAmount + attendantRate;
};

export const getNextTripTime = (lastTime: string): string => {
  if (!lastTime) return '09:00';

  try {
    const lastDate = parse(lastTime, 'HH:mm', new Date());
    const nextDate = addMinutes(lastDate, 35);
    return format(nextDate, 'HH:mm');
  } catch {
    return '09:00';
  }
};

export const generateDailySchedule = (startTime: string): string[] => {
  const schedule: string[] = [];
  try {
    let currentTime = parse(startTime, 'HH:mm', new Date());
    const endTime = parse('17:00', 'HH:mm', new Date());

    while (currentTime <= endTime) {
      schedule.push(format(currentTime, 'HH:mm'));
      currentTime = addMinutes(currentTime, 35);
    }
  } catch {
    return [];
  }

  return schedule;
};

export const calculateTripSummary = (trip: Trip, boatName: string) => {
  const totalAdults = trip.entries.reduce((sum, e) => sum + (e.adult || 0), 0);
  const totalChildren = trip.entries.reduce((sum, e) => sum + (e.child || 0), 0);
  const totalInfants = trip.entries.reduce((sum, e) => sum + (e.infant || 0), 0);
  const totalGroups = trip.entries.length;
  const totalRevenue = trip.entries.reduce((sum, e) => sum + (e.revenue || 0), 0);
  const totalCommission = trip.entries.reduce((sum, e) => sum + (e.commission || 0), 0);
  const totalProfit = trip.entries.reduce((sum, e) => sum + (e.profit || 0), 0);

  const calculatedCapacity = calculateTripCapacity(trip, boatName);
  const boatCapacity = BOAT_CAPACITY[boatName as keyof typeof BOAT_CAPACITY] || 0;
  const utilizationRate = boatCapacity > 0 ? Math.round((calculatedCapacity / boatCapacity) * 100) : 0;
  const remainingCapacity = Math.max(0, boatCapacity - calculatedCapacity);

  return {
    totalAdults,
    totalChildren,
    totalInfants,
    totalGroups,
    totalRevenue,
    totalCommission,
    totalProfit,
    calculatedCapacity,
    utilizationRate,
    remainingCapacity
  };
};

export const calculateBoatSummary = (trips: Trip[], boatName: string) => {
  let totalPassengers = 0;
  let totalAdults = 0;
  let totalChildren = 0;
  let totalInfants = 0;
  let totalGroups = 0;
  let totalRevenue = 0;
  let totalCommission = 0;
  let totalProfit = 0;
  let totalCapacity = 0;

  trips.forEach(trip => {
    const summary = calculateTripSummary(trip, boatName);
    totalAdults += summary.totalAdults;
    totalChildren += summary.totalChildren;
    totalInfants += summary.totalInfants;
    totalPassengers += summary.totalAdults + summary.totalChildren + summary.totalInfants;
    totalGroups += summary.totalGroups;
    totalRevenue += summary.totalRevenue;
    totalCommission += summary.totalCommission;
    totalProfit += summary.totalProfit;
    totalCapacity += summary.calculatedCapacity;
  });

  const boatCapacity = BOAT_CAPACITY[boatName as keyof typeof BOAT_CAPACITY] || 0;
  const maxCapacity = boatCapacity * trips.length;
  const utilizationRate = maxCapacity > 0 ? Math.round((totalCapacity / maxCapacity) * 100) : 0;

  return {
    totalPassengers,
    totalAdults,
    totalChildren,
    totalInfants,
    totalGroups,
    totalRevenue,
    totalCommission,
    totalProfit,
    tripCount: trips.length,
    utilizationRate
  };
};

export const calculateAllBoatsSummary = (boatsData: { [key: string]: { trips: Trip[] } }) => {
  let totalPassengers = 0;
  let totalAdults = 0;
  let totalChildren = 0;
  let totalInfants = 0;
  let totalGroups = 0;
  let totalRevenue = 0;
  let totalCommission = 0;
  let totalProfit = 0;
  let totalTrips = 0;
  let totalCapacity = 0;
  let maxCapacity = 0;

  const boatDetails: { [key: string]: { trips: number; utilization: number; capacity: number; maxCapacity: number } } = {};

  Object.entries(boatsData).forEach(([boatName, data]) => {
    const summary = calculateBoatSummary(data.trips, boatName);
    totalPassengers += summary.totalPassengers;
    totalAdults += summary.totalAdults;
    totalChildren += summary.totalChildren;
    totalInfants += summary.totalInfants;
    totalGroups += summary.totalGroups;
    totalRevenue += summary.totalRevenue;
    totalCommission += summary.totalCommission;
    totalProfit += summary.totalProfit;
    totalTrips += summary.tripCount;

    let boatCapacitySum = 0;
    let boatMaxCapacity = 0;
    data.trips.forEach(trip => {
      const tripCap = calculateTripCapacity(trip, boatName);
      boatCapacitySum += tripCap;
      totalCapacity += tripCap;
      const cap = BOAT_CAPACITY[boatName as keyof typeof BOAT_CAPACITY] || 0;
      boatMaxCapacity += cap;
      maxCapacity += cap;
    });

    boatDetails[boatName] = {
      trips: data.trips.length,
      utilization: boatMaxCapacity > 0 ? Math.round((boatCapacitySum / boatMaxCapacity) * 100) : 0,
      capacity: boatCapacitySum,
      maxCapacity: boatMaxCapacity
    };
  });

  const avgUtilizationRate = maxCapacity > 0 ? Math.round((totalCapacity / maxCapacity) * 100) : 0;

  return {
    totalPassengers,
    totalAdults,
    totalChildren,
    totalInfants,
    totalGroups,
    totalRevenue,
    totalCommission,
    totalProfit,
    tripCount: totalTrips,
    avgUtilizationRate,
    kajiTrips: boatDetails['カジ']?.trips || 0,
    muiTrips: boatDetails['ムイ']?.trips || 0,
    tidaTrips: boatDetails['ティダ']?.trips || 0,
    kajiUtilization: boatDetails['カジ']?.utilization || 0,
    muiUtilization: boatDetails['ムイ']?.utilization || 0,
    tidaUtilization: boatDetails['ティダ']?.utilization || 0
  };
};
