
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { handleAttendanceByCardId, createLinkRequest, updateLinkRequestStatus, getAllUsers, createAttendanceLogV2 } from '@/lib/data-adapter';
import type { AppUser, LinkRequest, AttendanceLog } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { onSnapshot, query, collection, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr' | 'manual_attendance';
export type TemporaryState = 'success' | 'error' | 'unregistered' | 'entry' | 'exit';
export type UserStatus = 'entry' | 'exit' | 'unknown' | 'loading';

interface KioskState {
    mode: KioskMode;
    tempState: TemporaryState | null;
    message: string;
    subMessage: string;
    inputBuffer: string;
    qrCodeUrl: string;
    registrationUrl: string;
    linkRequestToken: string | null;
    isOnline: boolean;
}

export const useKiosk = () => {
    const [state, setState] = useState<KioskState>({
        mode: 'waiting',
        tempState: null,
        message: 'NFCタグをタッチしてください',
        subMessage: 'カードリーダーにタッチするか、IDをキーボードで入力してください',
        inputBuffer: '',
        qrCodeUrl: '',
        registrationUrl: '',
        linkRequestToken: null,
        isOnline: true,
    });
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetToWaiting = useCallback(() => {
        setState(prev => ({
            ...prev,
            mode: 'waiting',
            tempState: null,
            message: 'NFCタグをタッチしてください',
            subMessage: 'カードリーダーにタッチするか、IDをキーボードで入力してください',
            qrCodeUrl: '',
            registrationUrl: '',
            linkRequestToken: null,
            inputBuffer: '',
        }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const showTemporaryMessage = useCallback((mainMsg: string, subMsg = '', tempState: TemporaryState, duration = 3000) => {
        setState(prev => ({ ...prev, message: mainMsg, subMessage: subMsg, tempState, inputBuffer: '' }));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(resetToWaiting, duration);
    }, [resetToWaiting]);

    useEffect(() => {
        const updateOnlineStatus = () => setState(prev => ({ ...prev, isOnline: navigator.onLine }));
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
        getAllUsers().then(setAllUsers);
        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleAttendance = useCallback(async (cardId: string) => {
        const result = await handleAttendanceByCardId(cardId);
        showTemporaryMessage(result.message, result.subMessage, result.status);
    }, [showTemporaryMessage]);
    
    const handleManualAttendance = async (user: AppUser, type: 'entry' | 'exit') => {
        try {
          await createAttendanceLogV2(user.uid, type, user.cardId);
          const msg = `${user.firstname} ${user.lastname}さんの${type === 'entry' ? '出勤' : '退勤'}を記録しました。`;
          showTemporaryMessage('記録しました', msg, type);
        } catch (e) {
          showTemporaryMessage('エラー', '勤怠記録に失敗しました。', 'error');
        }
    }

    const fetchUserStatus = useCallback(async (userId: string): Promise<UserStatus> => {
        try {
            const user = allUsers.find(u => u.uid === userId);
            return user?.status || 'exit';
        } catch(e) {
            console.error("Error fetching user status:", e);
            return 'unknown';
        }
    }, [allUsers]);

    const handleRegistration = useCallback(async (cardId: string) => {
        setState(prev => ({ ...prev, mode: 'loading_qr', message: '登録用リンクを生成中...', subMessage: 'しばらくお待ちください' }));
        try {
            const token = uuidv4();
            await createLinkRequest(token);
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost';
            const url = `${baseUrl}/register?token=${token}&cardId=${cardId}`;
            setState(prev => ({
                ...prev,
                registrationUrl: url,
                qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`,
                linkRequestToken: token,
                mode: 'register_qr',
                message: 'QRコードをスキャンして登録',
                subMessage: 'スマートフォンで読み取り、表示された指示に従ってください。',
            }));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(resetToWaiting, 60000);
        } catch (err) {
            console.error("登録リンク生成エラー:", err);
            showTemporaryMessage('登録エラー', 'リンクを生成できませんでした。接続を確認してください。', 'error');
        }
    }, [showTemporaryMessage, resetToWaiting]);
    
    const handleManualModeToggle = () => {
        setState(prev => ({
            ...prev,
            mode: prev.mode === 'manual_attendance' ? 'waiting' : 'manual_attendance',
            message: prev.mode === 'manual_attendance' ? 'NFCタグをタッチしてください' : '名前またはGitHub IDで検索',
            subMessage: '',
        }));
    };
    
    const processInput = useCallback((input: string) => {
        if (!state.isOnline) {
            showTemporaryMessage('ネットワークがオフラインです', '接続を確認してから、再度お試しください。', 'error');
            return;
        }
        const trimmedInput = input.trim();
        if (trimmedInput.length < 3) return;

        // Clear any ongoing timeout when a new card is processed
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (state.mode === 'waiting' || state.tempState) {
            handleAttendance(trimmedInput);
        } else if (state.mode === 'register_prompt') {
            handleRegistration(trimmedInput);
        }
        setState(prev => ({ ...prev, inputBuffer: '' }));
    }, [state.mode, state.isOnline, state.tempState, handleAttendance, handleRegistration, showTemporaryMessage]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                resetToWaiting();
                return;
            }

            // Allow input even when a temp message is shown.
            if (e.key === 'Enter') {
                processInput(state.inputBuffer);
                return; // Prevent other keydown handlers for Enter
            }
            
            if (e.key.length === 1 && /^[a-z0-9]+$/i.test(e.key)) {
                if (state.mode !== 'manual_attendance') {
                     // Clear temp state on new input
                    if (state.tempState) {
                        setState(prev => ({ ...prev, tempState: null, message: 'NFCタグをタッチしてください', subMessage: 'カードリーダーにタッチするか、IDをキーボードで入力してください' }));
                    }
                    setState(prev => ({ ...prev, inputBuffer: prev.inputBuffer + e.key }));
                }
                return;
            }

            // Block mode changes while a temp message is shown
            if (state.tempState) {
                return;
            }

            if (state.mode === 'waiting' && state.inputBuffer === '') {
                if (e.key === ' ') {
                    e.preventDefault();
                    handleManualModeToggle();
                } else if (e.key === '/') {
                    e.preventDefault();
                    setState(prev => ({ ...prev, mode: 'register_prompt', message: '登録するカードのIDを入力してください', subMessage: 'IDを入力してEnterキーを押してください', inputBuffer: '' }));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.inputBuffer, state.mode, state.tempState, processInput, resetToWaiting, handleManualModeToggle]);

    useEffect(() => {
        if (state.mode === 'register_qr' && state.linkRequestToken) {
            updateLinkRequestStatus(state.linkRequestToken, 'opened').catch(err => console.error(err));
            const q = query(collection(db, "link_requests"), where("token", "==", state.linkRequestToken), limit(1));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data() as LinkRequest;
                    if (data.status === 'done') {
                        showTemporaryMessage('登録が完了しました！', 'カードを使って出退勤を記録できます。', 'success', 4000);
                        unsubscribe();
                    }
                }
            });
            return () => unsubscribe();
        }
    }, [state.mode, state.linkRequestToken, showTemporaryMessage]);

    return {
        state,
        ...state,
        allUsers,
        resetToWaiting,
        handleManualModeToggle,
        handleRegistration,
        handleManualAttendance,
        fetchUserStatus,
    };
};
