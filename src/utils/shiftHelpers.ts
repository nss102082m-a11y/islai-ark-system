import { ShiftType, User, CruiseShipInfo } from '../types';
import { getDaysInMonth, parse } from 'date-fns';

export const calculateMonthlyCost = (
  schedule: { [userId: string]: { [day: string]: ShiftType } },
  users: User[]
): number => {
  let totalCost = 0;

  users.forEach(user => {
    const userSchedule = schedule[user.uid] || {};
    let workDays = 0;

    Object.values(userSchedule).forEach(shift => {
      if (shift === '〇') workDays += 1;
      if (shift === '午前' || shift === '午後') workDays += 0.5;
    });

    const dailyRate =
      user.role === 'captain' ? 15000 :
      user.role === 'beach_staff' ? 12000 :
      user.role === 'reception' ? 10000 : 0;

    totalCost += workDays * dailyRate;
  });

  return totalCost;
};

export const calculateSalesTarget = (totalCost: number): number => {
  return Math.round(totalCost / 0.4);
};

export const calculateWorkDays = (
  userSchedule: { [day: string]: ShiftType }
): number => {
  let workDays = 0;

  Object.values(userSchedule).forEach(shift => {
    if (shift === '〇') workDays += 1;
    if (shift === '午前' || shift === '午後') workDays += 0.5;
  });

  return workDays;
};

export const calculateUserCost = (
  userSchedule: { [day: string]: ShiftType },
  role: string
): number => {
  const workDays = calculateWorkDays(userSchedule);

  const dailyRate =
    role === 'captain' ? 15000 :
    role === 'beach_staff' ? 12000 :
    role === 'reception' ? 10000 : 0;

  return workDays * dailyRate;
};

export const checkRequiredStaff = (
  schedule: { [userId: string]: { [day: string]: ShiftType } },
  users: User[],
  currentMonth: string
): string[] => {
  const warnings: string[] = [];
  const date = parse(currentMonth, 'yyyy-MM', new Date());
  const daysInMonth = getDaysInMonth(date);

  for (let day = 1; day <= daysInMonth; day++) {
    let captains = 0;
    let reception = 0;

    users.forEach(user => {
      const shift = schedule[user.uid]?.[day.toString()];
      if (shift === '〇' || shift === '午前' || shift === '午後') {
        if (user.role === 'captain') captains++;
        if (user.role === 'reception') reception++;
      }
    });

    if (captains < 2) {
      warnings.push(`${day}日: 船長が${captains}名（2名必要）`);
    }
    if (reception < 2) {
      warnings.push(`${day}日: 受付が${reception}名（2名必要）`);
    }
  }

  return warnings;
};

export const generateCSV = (
  schedule: { [userId: string]: { [day: string]: ShiftType } },
  users: User[],
  currentMonth: string
): string => {
  const date = parse(currentMonth, 'yyyy-MM', new Date());
  const daysInMonth = getDaysInMonth(date);

  const headers = ['スタッフ', '役職'];
  for (let day = 1; day <= daysInMonth; day++) {
    headers.push(day.toString());
  }
  headers.push('出勤日数', '人件費');

  const rows = [headers];

  users.forEach(user => {
    const row = [user.name, getRoleLabel(user.role)];

    for (let day = 1; day <= daysInMonth; day++) {
      const shift = schedule[user.uid]?.[day.toString()] || '-';
      row.push(shift);
    }

    const workDays = calculateWorkDays(schedule[user.uid] || {});
    const cost = calculateUserCost(schedule[user.uid] || {}, user.role);

    row.push(workDays.toString());
    row.push(cost.toString());

    rows.push(row);
  });

  return rows.map(row => row.join(',')).join('\n');
};

export const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'owner_executive':
      return 'オーナー・役員';
    case 'admin':
      return '管理者';
    case 'captain':
      return '船長';
    case 'beach_staff':
      return 'ビーチスタッフ';
    case 'reception':
      return '受付';
    case 'kiosk':
      return 'キオスク';
    default:
      return role;
  }
};

export const getCruiseShipColor = (passengers?: number): CruiseShipInfo['color'] => {
  if (!passengers) return 'none';
  if (passengers >= 4000) return 'red';
  if (passengers >= 3000) return 'yellow';
  if (passengers >= 2000) return 'blue';
  return 'none';
};
