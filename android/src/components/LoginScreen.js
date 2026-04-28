/**
 * Login / Register screen.
 *
 * Props:
 *   loginUser, setLoginUser, loginPass, setLoginPass,
 *   doLogin, doRegister, authLoading, authLoadingText
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, SafeAreaView, StatusBar,
  StyleSheet,
} from 'react-native';
import { COLORS, DEFAULT_SERVER_URL } from '../constants/theme';

export default function LoginScreen({
  loginUser, setLoginUser,
  loginPass, setLoginPass,
  doLogin, doRegister,
  authLoading, authLoadingText,
}) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.loginTitle}>SahabNote</Text>
        <Text style={styles.loginSubtitle}>Sign in to sync your notes</Text>

        <TextInput
          style={styles.loginInput}
          placeholder="Username"
          placeholderTextColor={COLORS.textSecondary}
          value={loginUser}
          onChangeText={setLoginUser}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!authLoading}
        />
        <TextInput
          style={styles.loginInput}
          placeholder="Password"
          placeholderTextColor={COLORS.textSecondary}
          value={loginPass}
          onChangeText={setLoginPass}
          secureTextEntry
          editable={!authLoading}
        />

        {authLoading && (
          <View style={styles.authLoadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.authLoadingText}>{authLoadingText}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.loginBtn, authLoading && styles.btnDisabled]}
          onPress={doLogin}
          disabled={authLoading}
        >
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.registerBtn, authLoading && styles.btnDisabled]}
          onPress={doRegister}
          disabled={authLoading}
        >
          <Text style={styles.registerBtnText}>Register</Text>
        </TouchableOpacity>

        <Text style={styles.loginServerUrl}>Server: {DEFAULT_SERVER_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loginContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  loginTitle: { fontSize: 32, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  loginSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32 },
  loginInput: {
    padding: 14, backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 15,
    color: COLORS.text, marginBottom: 12,
  },
  authLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 8 },
  authLoadingText: { fontSize: 14, color: COLORS.primary },
  loginBtn: {
    padding: 14, backgroundColor: COLORS.primary, borderRadius: 10,
    alignItems: 'center', marginBottom: 10,
  },
  registerBtn: {
    padding: 14, backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  registerBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 16 },
  loginServerUrl: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
});
