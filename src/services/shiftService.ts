import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';

// Cloud Function URL
const FUNCTION_URL = 'https://us-central1-islai-ark-d6035.cloudfunctions.net/generateShift';

// シフトデータの型定義
export interface ShiftData {
  month: string;
  schedule: {
    [userId: string]: {
      [day: string]: '○' | '午前' | '午後' | '休';
    };
  };
  cruiseShips: {
    [day: string]: {
      hasShip: boolean;
      passengers: number;
      color: 'none' | 'blue' | 'yellow' | 'red';
    };
  };
}

// AIシフト自動生成
export async function generateShiftWithAI(
  month: string,
  users: Array<{ id: string; name: string; role: string }>,
  cruiseShips?: ShiftData['cruiseShips']
): Promise<ShiftData> {
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        month,
        users,
        cruiseShips,
      }),
    });

    if (!response.ok) {
      throw new Error(`AIシフト生成に失敗しました: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('AIシフト生成エラー:', error);
    throw error;
  }
}

// シフトデータを取得
export async function getShiftData(month: string): Promise<ShiftData | null> {
  try {
    const shiftDoc = await getDoc(doc(db, 'shifts', month));
    if (shiftDoc.exists()) {
      return shiftDoc.data() as ShiftData;
    }
    return null;
  } catch (error) {
    console.error('シフトデータ取得エラー:', error);
    throw error;
  }
}

// シフトデータを保存
export async function saveShiftData(shiftData: ShiftData): Promise<void> {
  try {
    await setDoc(doc(db, 'shifts', shiftData.month), shiftData);
  } catch (error) {
    console.error('シフトデータ保存エラー:', error);
    throw error;
  }
}
