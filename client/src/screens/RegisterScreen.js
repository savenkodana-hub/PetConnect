import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import AuthFormCard from '../components/AuthFormCard';
import { useAuth } from '../context/AuthContext';

const getErrorMessage = (error) =>
  error.response?.data?.message || 'Registration failed. Please try again.';

export default function RegisterScreen({ navigation }) {
  const { register, authError, setAuthError } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (name, value) => {
    setAuthError('');
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async () => {
    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();
    if (!username || !email || !form.password) {
      setAuthError('Username, email, and password are required.');
      return;
    }
    if (username.length < 2 || username.length > 50) {
      setAuthError('Username must be 2-50 characters.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }
    if (form.password.length < 6 || form.password.length > 128) {
      setAuthError('Password must be 6-128 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({ username, email, password: form.password });
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.heroBubble} />
      <AuthFormCard
        title="Create account"
        subtitle="Join local pet owners and start building your pet profile."
        fields={[
          {
            name: 'username',
            label: 'Username',
            placeholder: 'Maya Cohen',
            value: form.username,
            autoCapitalize: 'words'
          },
          {
            name: 'email',
            label: 'Email',
            placeholder: 'maya@example.com',
            value: form.email,
            keyboardType: 'email-address'
          },
          {
            name: 'password',
            label: 'Password',
            placeholder: 'At least 6 characters',
            value: form.password,
            secureTextEntry: true
          }
        ]}
        buttonText="Register"
        footerText="Already have an account?"
        footerActionText="Log in"
        error={authError}
        isSubmitting={isSubmitting}
        onChangeField={updateField}
        onSubmit={handleSubmit}
        onFooterPress={() => navigation.navigate('Login')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#eef8f0'
  },
  heroBubble: {
    position: 'absolute',
    bottom: -90,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ccebd6'
  }
});
