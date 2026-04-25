import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = '@sahabnote_users';
const CURRENT_USER_KEY = '@sahabnote_current_user';

/**
 * Mock auth service for SahabNote.
 * In a production app, this would communicate with a backend API.
 */

// In-memory fallback when AsyncStorage is not available
let inMemoryUsers = [];
let inMemoryCurrentUser = null;
let useInMemory = false;

const getUsers = async () => {
  if (useInMemory) return inMemoryUsers;
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    useInMemory = true;
    return inMemoryUsers;
  }
};

const saveUsers = async (users) => {
  if (useInMemory) {
    inMemoryUsers = users;
    return;
  }
  try {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    useInMemory = true;
    inMemoryUsers = users;
  }
};

/**
 * Register a new user.
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export const registerUser = async (name, email, password) => {
  // Validate inputs
  if (!name || !name.trim()) {
    return { success: false, error: 'Name is required.' };
  }
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const users = await getUsers();

  // Check if email already exists
  const existingUser = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  // Create new user (in production, hash the password)
  const newUser = {
    id: Date.now().toString(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password, // ⚠️ In production, never store plain text passwords
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await saveUsers(users);

  // Don't return password to the client
  const { password: _, ...safeUser } = newUser;

  return { success: true, user: safeUser };
};

/**
 * Log in an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export const loginUser = async (email, password) => {
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  const users = await getUsers();

  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password
  );

  if (!user) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const { password: _, ...safeUser } = user;
  return { success: true, user: safeUser };
};

/**
 * Save the current logged-in user session.
 * @param {object} user
 */
export const saveCurrentUser = async (user) => {
  if (useInMemory) {
    inMemoryCurrentUser = user;
    return;
  }
  try {
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch {
    inMemoryCurrentUser = user;
  }
};

/**
 * Get the current logged-in user session.
 * @returns {Promise<object|null>}
 */
export const getCurrentUser = async () => {
  if (useInMemory) return inMemoryCurrentUser;
  try {
    const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return inMemoryCurrentUser;
  }
};

/**
 * Clear the current user session (log out).
 */
export const logoutUser = async () => {
  if (useInMemory) {
    inMemoryCurrentUser = null;
    return;
  }
  try {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    inMemoryCurrentUser = null;
  }
};
