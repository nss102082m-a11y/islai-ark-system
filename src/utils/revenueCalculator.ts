import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * 指定月の売上を計算
 */
export const calculateMonthlyRevenue = async (year: number, month: number): Promise<number> => {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalRevenue = 0;

    console.log(`=== 月間売上計算開始: ${year}年${month}月 ===`);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const docRef = doc(db, 'boarding_data', dateStr);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        let dayRevenue = 0;

        // 各船のデータを確認
        Object.keys(data).forEach(boatKey => {
          const boatData = data[boatKey];

          // tripsプロパティが存在するかどうかで船のデータと判定
          if (boatData && boatData.trips && Array.isArray(boatData.trips)) {
            boatData.trips.forEach((trip: any) => {
              // entriesから売上を集計
              if (trip.entries && Array.isArray(trip.entries)) {
                trip.entries.forEach((entry: any) => {
                  dayRevenue += entry.revenue || 0;
                });
              }
            });
          }
        });

        if (dayRevenue > 0) {
          console.log(`${dateStr}: ¥${dayRevenue.toLocaleString()}`);
        }
        totalRevenue += dayRevenue;
      }
    }

    console.log(`=== 月間売上計算完了: ¥${totalRevenue.toLocaleString()} ===`);
    return totalRevenue;
  } catch (error) {
    console.error('❌ 売上計算エラー:', error);
    return 0;
  }
};

/**
 * 今日の売上を計算
 */
export const calculateTodayRevenue = async (): Promise<number> => {
  try {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const docRef = doc(db, 'boarding_data', dateStr);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return 0;
    }

    const data = docSnap.data();
    let totalRevenue = 0;

    // 各船のデータを確認
    Object.keys(data).forEach(boatKey => {
      const boatData = data[boatKey];

      // tripsプロパティが存在するかどうかで船のデータと判定
      if (boatData && boatData.trips && Array.isArray(boatData.trips)) {
        boatData.trips.forEach((trip: any) => {
          // entriesから売上を集計
          if (trip.entries && Array.isArray(trip.entries)) {
            trip.entries.forEach((entry: any) => {
              totalRevenue += entry.revenue || 0;
            });
          }
        });
      }
    });

    console.log(`本日の売上: ¥${totalRevenue.toLocaleString()}`);
    return totalRevenue;
  } catch (error) {
    console.error('❌ 本日の売上計算エラー:', error);
    return 0;
  }
};
