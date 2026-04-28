/**
 * Auth state management hook.
 *
 * Manages: isAuthenticated, authLoading, authLoadingText, login form state,
 * login/register/logout actions.
 */

import { useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { SyncClient } from '../utils/sync';
import { saveSettings, loadNotes } from '../utils/storage';
import { DEFAULT_SERVER_URL } from '../constants/theme';

export default function useAuth(syncClientRef, setNotes) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const afterAuthSuccess = async (token) => {
    await saveSettings({ server_url: DEFAULT_SERVER_URL, auth_token: token });
    syncClientRef.current.setAuthToken(token);
    try { await syncClientRef.current.pullServerChanges(); } catch {}
    setNotes(await loadNotes());
    setIsAuthenticated(true);
    setAuthLoading(false);
  };

  const doAuthAction = async (endpoint, loadingMsg, failMsg) => {
    Keyboard.dismiss();
    if (!loginUser || !loginPass) {
      Alert.alert('Error', 'Enter a username and password'); return;
    }
    setAuthLoading(true);
    setAuthLoadingText(loadingMsg);
    try {
      const client = new SyncClient(DEFAULT_SERVER_URL);
      const resp = await client.request('POST', endpoint, {
        username: loginUser, password: loginPass,
      });
      resp.success
        ? await afterAuthSuccess(resp.data.access_token)
        : (setAuthLoading(false), Alert.alert(failMsg, resp.message || 'Please try again'));
    } catch (e) { setAuthLoading(false); Alert.alert('Error', e.message); }
  };

  const doRegister = () => doAuthAction('/api/auth/register', 'Registering...', 'Registration Failed');
  const doLogin = () => doAuthAction('/api/auth/login', 'Logging in...', 'Login Failed');

  const handleLogout = async (saveCurrentNote) => {
    if (saveCurrentNote) await saveCurrentNote();
    await saveSettings({});
    setLoginUser('');
    setLoginPass('');
    setIsAuthenticated(false);
    syncClientRef.current.setAuthToken('');
  };

  return {
    isAuthenticated, setIsAuthenticated,
    authLoading, setAuthLoading,
    authLoadingText, setAuthLoadingText,
    loginUser, setLoginUser,
    loginPass, setLoginPass,
    afterAuthSuccess, doRegister, doLogin, handleLogout,
  };
}
