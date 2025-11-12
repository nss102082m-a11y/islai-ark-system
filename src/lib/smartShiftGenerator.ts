export interface User {
  id: string;
  name: string;
  category: string;
}

export interface Settings {
  requiredStaff: {
    captains: number;
    reception: number;
    beachStaff: number;
  };
}

export interface CruiseShip {
  day: number;
  hasShip: boolean;
}

export async function generateSmartShift(
  month: string,
  users: User[],
  cruiseShips: CruiseShip[],
  settings: Settings
): Promise<any> {
  const daysInMonth = new Date(
    parseInt(month.split('-')[0]),
    parseInt(month.split('-')[1]),
    0
  ).getDate();

  const captains = users.filter(u => u.category?.includes('船長'));
  const beach = users.filter(u => u.category?.includes('浜'));
  const reception = users.filter(u => u.category?.includes('受付'));

  console.log('カテゴリー別人数:', {
    captains: captains.length,
    beach: beach.length,
    reception: reception.length,
  });

  const workDays: { [userId: string]: number } = {};
  const consecutiveWork: { [userId: string]: number } = {};
  users.forEach(u => {
    workDays[u.id] = 0;
    consecutiveWork[u.id] = 0;
  });

  const schedule: any = {};
  users.forEach(u => {
    schedule[u.id] = {};
  });

  const cruiseDays = new Set(cruiseShips.filter(s => s.hasShip).map(s => s.day));

  const targetWorkDays = Math.floor(daysInMonth * 0.7);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day);
    const isCruiseDay = cruiseDays.has(day);

    if (isCruiseDay) {
      users.forEach(u => {
        schedule[u.id][dayStr] = '〇';
        workDays[u.id]++;
        consecutiveWork[u.id]++;
      });
    } else {
      const needed = {
        captains: settings.requiredStaff.captains,
        beach: settings.requiredStaff.beachStaff,
        reception: settings.requiredStaff.reception,
      };

      const selectStaff = (staffList: User[], count: number) => {
        return staffList
          .filter(u => {
            if (consecutiveWork[u.id] >= 5) return false;
            if (workDays[u.id] > targetWorkDays + 3) return false;
            return true;
          })
          .sort((a, b) => {
            const diffWork = workDays[a.id] - workDays[b.id];
            if (diffWork !== 0) return diffWork;
            return consecutiveWork[a.id] - consecutiveWork[b.id];
          })
          .slice(0, count);
      };

      const selectedCaptains = selectStaff(captains, needed.captains);
      const selectedBeach = selectStaff(beach, needed.beach);
      const selectedReception = selectStaff(reception, needed.reception);

      const workingToday = new Set([
        ...selectedCaptains.map(u => u.id),
        ...selectedBeach.map(u => u.id),
        ...selectedReception.map(u => u.id),
      ]);

      users.forEach(u => {
        if (workingToday.has(u.id)) {
          schedule[u.id][dayStr] = '〇';
          workDays[u.id]++;
          consecutiveWork[u.id]++;
        } else {
          schedule[u.id][dayStr] = '休';
          consecutiveWork[u.id] = 0;
        }
      });
    }
  }

  console.log('シフト生成完了');
  console.log('各人の勤務日数:', workDays);

  return {
    month,
    schedule,
    cruiseShips: {},
    helpers: []
  };
}
