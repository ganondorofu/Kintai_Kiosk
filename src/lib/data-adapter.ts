
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, query, where, onSnapshot, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch, collectionGroup, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, AttendanceLog, LinkRequest, Team, MonthlyAttendanceCache, Notification } from '@/types';
import type { GitHubUser } from './oauth';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * 既存のFirestoreデータ構造とOAuth認証を統合するためのアダプター
 * 
 * 重要な発見：旧プロジェクトの構成
 * - プロジェクトA（認証用）: Firebase Auth + GitHub OAuth
 * - プロジェクトB（データ用）: Firestore のみ（Firebase Auth設定なし）
 * - UID: Firebase Auth UID（28文字）をプロジェクト間で共有
 * 
 * 移行戦略：
 * - 既存のFirebase Auth UIDを保持
 * - GitHubアカウント名で既存ユーザーを特定
 * - 同じUIDで新しい認証システムからアクセス
 */

// timestamp を安全に Date オブジェクトに変換するヘルパー関数
// 旧プロジェクトでは new Date() で保存され、Firestore Timestamp として読み取られる
export const safeTimestampToDate = (timestamp: any): Date | null => {
  try {
    if (!timestamp) return null;
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (timestamp && typeof timestamp === 'number') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (timestamp && timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
      return new Timestamp(timestamp._seconds, timestamp._nanoseconds).toDate();
    }
    console.warn('無効なタイムスタンプ形式:', timestamp);
    return null;
  } catch (error) {
    console.error('タイムスタンプ変換エラー:', error, timestamp);
    return null;
  }
};

// 新しいデータ構造用のヘルパー関数
const getAttendancePath = (date: Date): { year: string, month: string, day: string, fullPath: string } => {
  // JST (UTC+9) で日付を取得
  const jstDate = new Date(date.getTime());
  const year = jstDate.getFullYear().toString();
  const month = (jstDate.getMonth() + 1).toString().padStart(2, '0');
  const day = jstDate.getDate().toString().padStart(2, '0');
  
  return {
    year,
    month,
    day,
    fullPath: `${year}/${month}/${day}`
  };
};

// 日付範囲から年月のリストを生成
const getYearMonthsInRange = (startDate: Date, endDate: Date): { year: string, month: string }[] => {
  const yearMonths: { year: string, month: string }[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  while (current <= end) {
    const year = current.getFullYear().toString();
    const month = (current.getMonth() + 1).toString().padStart(2, '0');
    yearMonths.push({ year, month });
    current.setMonth(current.getMonth() + 1);
  }
  
  return yearMonths;
};

// 期生から学年への変換ヘルパー関数
// 2025年時点: 8期生=3年生, 9期生=2年生, 10期生=1年生
const convertKiseiiToGrade = (kiseiNumber: number, currentYear: number = new Date().getFullYear()): number => {
  // 基準年（2025年）における期生と学年の対応
  const baseYear = 2025;
  const baseKiseiToGrade: Record<number, number> = {
    8: 3,  // 8期生 = 3年生
    9: 2,  // 9期生 = 2年生
    10: 1, // 10期生 = 1年生
  };

  // 年が変わった場合の調整
  const yearDifference = currentYear - baseYear;
  
  if (baseKiseiToGrade[kiseiNumber]) {
    const adjustedGrade = baseKiseiToGrade[kiseiNumber] + yearDifference;
    // 学年は1-3の範囲内に制限
    return Math.max(1, Math.min(3, adjustedGrade));
  }

  // 基準データにない場合の推定計算
  // 10期生を基準として、期生が1つ下がると学年が1つ上がる
  const baseKisei = 10; // 10期生 = 1年生（2025年基準）
  const estimatedGrade = 1 + (baseKisei - kiseiNumber) + yearDifference;
  
  return Math.max(1, Math.min(3, estimatedGrade));
};

// 全ユーザー一覧を取得（管理者専用）
export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    } as AppUser));

    return users;

  } catch (error) {
    console.error('全ユーザー取得エラー:', error);
    return [];
  }
};

// チーム一覧を取得（重複を許容しないように修正）
export const getAllTeams = async (): Promise<Team[]> => {
  try {
    const teamsRef = collection(db, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    // IDの重複を排除
    const teamMap = new Map<string, Team>();
    snapshot.docs.forEach(doc => {
      const team = {
        id: doc.id,
        ...doc.data() as Omit<Team, 'id'>
      } as Team;
      teamMap.set(doc.id, team);
    });
    
    return Array.from(teamMap.values());
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

// 期生データを学年表示用に変換する関数
export const formatKiseiAsGrade = (kiseiNumber: number): string => {
  const grade = convertKiseiiToGrade(kiseiNumber);
  return `${grade}年生（${kiseiNumber}期生）`;
};

// GitHubアカウント名で既存ユーザーを検索
const findUserByGitHub = async (githubLogin: string): Promise<AppUser | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('github', '==', githubLogin));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        uid: doc.id,  // 既存のFirebase Auth UIDをそのまま使用
        ...doc.data() as Omit<AppUser, 'uid'>
      } as AppUser;
    }
    
    return null;
  } catch (error) {
    console.error('GitHub名でのユーザー検索エラー:', error);
    return null;
  }
};


// 新しいデータ構造用のヘルパー関数
export const createAttendanceLogV2 = async (
  uid: string, 
  type: 'entry' | 'exit',
  cardId?: string
): Promise<boolean> => {
  try {
    const logId = `${uid}_${Date.now()}`;
    return await createAttendanceLogV2WithId(uid, type, cardId, logId);
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

export const createAttendanceLogV2WithId = async (
  uid: string, 
  type: 'entry' | 'exit',
  cardId: string | undefined,
  logId: string
): Promise<boolean> => {
  try {
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    
    const dateKey = `${year}-${month}-${day}`;
    const logRef = doc(db, 'attendances', dateKey, 'logs', logId);
    
    const logData: Omit<AttendanceLog, 'id'> = {
      uid,
      type,
      timestamp: Timestamp.now(),
      cardId: cardId || ''
    };
    
    await setDoc(logRef, {
      ...logData,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

export const getUserAttendanceLogsV2 = async (
  uid: string,
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    // If no date range, we are looking for the most recent log.
    if (!startDate && !endDate && limitCount === 1) {
        const now = new Date();
        // Check logs from today and up to 365 days ago
        for (let i = 0; i < 365; i++) {
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() - i);
            const { year, month, day } = getAttendancePath(targetDate);
            const dateKey = `${year}-${month}-${day}`;

            const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
            const q = query(dayLogsRef, where('uid', '==', uid), orderBy('timestamp', 'desc'), limit(1));
            
            try {
                const daySnapshot = await getDocs(q);
                if (!daySnapshot.empty) {
                    const latestLog = daySnapshot.docs[0].data() as AttendanceLog;
                    latestLog.id = daySnapshot.docs[0].id;
                    return [latestLog];
                }
            } catch (e) {
                // This can happen if the subcollection doesn't exist, which is fine.
            }
        }
        // If no logs in new structure, fallback to old structure
        return await getUserAttendanceLogs(uid, undefined, undefined, 1);
    }
    
    // Logic for date range query remains, but it's less common for the kiosk
    const logs: AttendanceLog[] = [];
    const effectiveStartDate = startDate || new Date(0);
    const effectiveEndDate = endDate || new Date();

    const yearMonths = getYearMonthsInRange(effectiveStartDate, effectiveEndDate);

    for (const { year, month } of yearMonths.reverse()) {
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const startDay =
        effectiveEndDate.getFullYear().toString() === year &&
        (effectiveEndDate.getMonth() + 1).toString().padStart(2, '0') === month
          ? effectiveEndDate.getDate()
          : daysInMonth;

      const endDay =
        effectiveStartDate.getFullYear().toString() === year &&
        (effectiveStartDate.getMonth() + 1).toString().padStart(2, '0') === month
          ? effectiveStartDate.getDate()
          : 1;

      for (let day = startDay; day >= endDay; day--) {
        const dayStr = day.toString().padStart(2, '0');
        const dateKey = `${year}-${month}-${dayStr}`;
        const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');

        const q = query(
          dayLogsRef,
          where('uid', '==', uid),
          orderBy('timestamp', 'desc')
        );

        const daySnapshot = await getDocs(q);
        const dayLogs = daySnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as AttendanceLog)
        );

        logs.push(...dayLogs);
      }
    }

    // Fallback to old logs if new logs are not enough
    if (logs.length < limitCount) {
      const oldLogs = await getUserAttendanceLogs(
        uid,
        startDate,
        endDate,
        limitCount - logs.length
      );
      logs.push(...oldLogs);
    }
    
    return logs
      .sort((a, b) => {
        const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('新しい勤怠ログ取得エラー:', error);
    // Fallback to old logs on error
    return await getUserAttendanceLogs(uid, startDate, endDate, limitCount);
  }
};

export const getUserAttendanceLogs = async (
  uid: string, 
  startDate?: Date, 
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    let q = query(
      logsRef, 
      where('uid', '==', uid),
      orderBy('timestamp', 'desc')
    );

    if (startDate && endDate) {
      q = query(q, where('timestamp', '>=', startDate), where('timestamp', '<=', endDate));
    }
    
    q = query(q, limit(limitCount));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  } catch (error) {
    console.error('ユーザー勤怠ログ取得エラー:', error);
    return [];
  }
};


export const generateAttendanceLogId = (uid: string): string => {
  return `${uid}_${Date.now()}`;
};


export const createLinkRequest = async (token: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'link_requests'), {
    token,
    status: 'waiting',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateLinkRequestStatus = async (token: string, status: 'opened' | 'linked' | 'done', cardId?: string): Promise<void> => {
    const q = query(collection(db, 'link_requests'), where('token', '==', token), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error('Link request not found.');
    }

    const docRef = snapshot.docs[0].ref;
    const dataToUpdate: any = {
        status,
        updatedAt: serverTimestamp(),
    };
    if (cardId) {
        dataToUpdate.cardId = cardId;
    }

    await updateDoc(docRef, dataToUpdate);
}


export const watchTokenStatus = (
  token: string,
  callback: (status: string, data?: LinkRequest) => void
) => {
  const q = query(collection(db, 'link_requests'), where('token', '==', token), limit(1));
  
  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data() as LinkRequest;
      callback(docData.status, docData);
    }
  });
};

export const handleAttendanceByCardId = async (cardId: string): Promise<{
  status: 'success' | 'error' | 'unregistered' | 'entry' | 'exit';
  message: string;
  subMessage?: string;
}> => {
  try {
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('cardId', '==', cardId), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return { status: 'unregistered', message: '未登録のカードです', subMessage: '登録するには「/」キーを押してください' };
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data() as AppUser;
    const userId = userDoc.id;

    const [latestLog] = await getUserAttendanceLogsV2(userId, undefined, undefined, 1);
    
    const logType: 'entry' | 'exit' = latestLog?.type === 'entry' ? 'exit' : 'entry';
    
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    const dateKey = `${year}-${month}-${day}`;
    
    const batch = writeBatch(db);
    const newLogId = generateAttendanceLogId(userId);
    const newLogRef = doc(db, 'attendances', dateKey, 'logs', newLogId);

    batch.set(newLogRef, {
      uid: userId,
      cardId: cardId,
      type: logType,
      timestamp: serverTimestamp(),
    });

    await batch.commit();

    const userName = `${userData.lastname} ${userData.firstname}`;
    
    if (logType === 'entry') {
      return { status: 'entry', message: `${userName}さん、こんにちは！`, subMessage: '出勤を記録しました' };
    } else {
      return { status: 'exit', message: `${userName}さん、お疲れ様でした！`, subMessage: '退勤を記録しました' };
    }
  } catch (err) {
    console.error("勤怠記録エラー:", err);
    return { status: 'error', message: 'エラーが発生しました', subMessage: 'もう一度お試しください' };
  }
};

// Firestoreからお知らせを取得する関数
export const getNotifications = async (count: number = 5): Promise<Notification[]> => {
    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(count));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Notification));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
};

// 新しいお知らせを作成
export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>): Promise<string | null> => {
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            ...notification,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// お知らせを更新
export const updateNotification = async (id: string, updates: Partial<Omit<Notification, 'id'>>): Promise<boolean> => {
    try {
        const docRef = doc(db, 'notifications', id);
        await updateDoc(docRef, updates);
        return true;
    } catch (error) {
        console.error('Error updating notification:', error);
        return false;
    }
};

// お知らせを削除
export const deleteNotification = async (id: string): Promise<boolean> => {
    try {
        const docRef = doc(db, 'notifications', id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error('Error deleting notification:', error);
        return false;
    }
};
